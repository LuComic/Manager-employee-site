/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "owner-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-a",
}
const otherIdentity = {
  subject: "owner-b",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-b",
}

async function createHub(
  t: ReturnType<typeof convexTest>,
  options: {
    restricted?: boolean
    identity?: typeof ownerIdentity
    slug?: string
  } = {}
) {
  const identity = options.identity ?? ownerIdentity
  return await t.withIdentity(identity).mutation(api.hubs.create, {
    name: options.slug === "other" ? "Other Hub" : "Test Hub",
    slug: options.slug ?? "test-hub",
    accessMode: options.restricted ? "restricted" : "public",
    joinCode: "ABCD-EFGH",
    privateToken: "private-token-that-is-at-least-thirty-two-characters",
    timeZone: "Europe/Tallinn",
    seedDemoContent: false,
  })
}

describe("hub authorization and anonymous access", () => {
  test("isolates manager data by Clerk owner", async () => {
    const t = convexTest(schema, modules)
    await createHub(t)

    expect(
      (
        await t
          .withIdentity(ownerIdentity)
          .query(api.hubs.getOwnedSnapshot, { nowDate: "2026-07-18" })
      ).kind
    ).toBe("ready")
    expect(
      (
        await t
          .withIdentity(otherIdentity)
          .query(api.hubs.getOwnedSnapshot, { nowDate: "2026-07-18" })
      ).kind
    ).toBe("none")
  })

  test("accepts current restricted credentials and rejects invalid ones", async () => {
    const t = convexTest(schema, modules)
    await createHub(t, { restricted: true })

    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("restricted")
    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          credential: "abcd efgh",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("ready")
    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          credential: "private-token-that-is-at-least-thirty-two-characters",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("ready")
    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          credential: "wrong-code",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("restricted")
  })

  test("credential rotation revokes old codes and links", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t, { restricted: true })
    await t.withIdentity(ownerIdentity).mutation(api.hubs.rotateCredentials, {
      hubId,
      joinCode: "JKLM-NPQR",
      privateToken: "replacement-private-token-that-is-long-enough-123",
    })

    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          credential: "ABCD-EFGH",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("restricted")
    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          credential: "JKLM-NPQR",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("ready")
  })

  test("rejects a manager mutating another owner's hub", async () => {
    const t = convexTest(schema, modules)
    await createHub(t)
    const other = await createHub(t, { identity: otherIdentity, slug: "other" })

    await expect(
      t.withIdentity(ownerIdentity).mutation(api.content.saveCategory, {
        hubId: other.hubId,
        slug: "stolen",
        label: "Stolen",
        iconKey: "general",
        description: "Must not be written",
      })
    ).rejects.toThrow("Unauthorized")
  })

  test("publishes managed FAQs and keeps help requests owner-only", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)

    await owner.mutation(api.content.saveFaq, {
      hubId,
      slug: "where-are-keys",
      question: "Where are the keys?",
      answer: "Ask the opening manager.",
      published: true,
    })
    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "test-hub",
      credential: "ABCD-EFGH",
      nowDate: "2026-07-18",
    })
    expect(snapshot.kind).toBe("ready")
    if (snapshot.kind === "ready") {
      expect(snapshot.faqs).toHaveLength(1)
    }

    await t.mutation(api.content.submitHelpRequest, {
      hubSlug: "test-hub",
      credential: "ABCD-EFGH",
      topic: "Keys",
      message: "I cannot find the opening keys.",
    })
    expect(
      await owner.query(api.content.listHelpRequests, { hubId })
    ).toHaveLength(1)
    await expect(
      t.withIdentity(otherIdentity).query(api.content.listHelpRequests, {
        hubId,
      })
    ).rejects.toThrow("Unauthorized")
  })

  test("anonymous snapshots hide drafts and relational deletion cleans links", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)
    await owner.mutation(api.content.saveCategory, {
      hubId,
      slug: "ops",
      label: "Operations",
      iconKey: "general",
      description: "Operational guides",
    })
    const content = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Instructions" }],
        },
      ],
    }
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "published-guide",
      title: "Published guide",
      description: "Visible",
      categorySlug: "ops",
      duration: "3 min",
      featured: false,
      published: true,
      keywords: [],
      content,
    })
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "draft-guide",
      title: "Draft guide",
      description: "Hidden",
      categorySlug: "ops",
      duration: "3 min",
      featured: false,
      published: false,
      keywords: [],
      content,
    })
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "event",
      title: "Event",
      description: "Visible event",
      category: "Training",
      start: "2026-07-19T10:00",
      end: "2026-07-19T11:00",
      location: "Office",
      owner: "Manager",
      notes: "",
      published: true,
      guideSlugs: ["published-guide"],
    })
    await owner.mutation(api.content.saveAnnouncement, {
      hubId,
      slug: "announcement",
      title: "Announcement",
      content,
      publishedAt: "2026-07-18",
      expiresAt: "2026-07-20",
      priority: "Normal",
      pinned: false,
      published: true,
      guideSlug: "published-guide",
      eventSlug: "event",
    })

    const publicBefore = await t.query(api.hubs.getPublicSnapshot, {
      slug: "test-hub",
      credential: "ABCD-EFGH",
      nowDate: "2026-07-18",
    })
    expect(publicBefore.kind).toBe("ready")
    if (publicBefore.kind !== "ready")
      throw new Error("Expected public snapshot")
    expect(publicBefore.guides.map((guide) => guide.id)).toEqual([
      "published-guide",
    ])

    await owner.mutation(api.content.deleteGuide, {
      hubId,
      slug: "published-guide",
    })
    const managerAfter = await owner.query(api.hubs.getOwnedSnapshot, {
      nowDate: "2026-07-18",
    })
    if (managerAfter.kind !== "ready")
      throw new Error("Expected manager snapshot")
    expect(managerAfter.events[0].guideIds).toEqual([])
    expect(managerAfter.announcements[0].guideId).toBeUndefined()
  })

  test("documents enforce ownership, draft visibility, search, and deletion", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)
    const body = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Emergency contact details" }],
        },
      ],
    }

    await owner.mutation(api.documents.save, {
      hubId,
      slug: "safety-notes",
      title: "Safety notes",
      description: "Important emergency information",
      type: "text",
      content: { kind: "text", body },
      published: true,
    })
    await owner.mutation(api.documents.save, {
      hubId,
      slug: "private-rota",
      title: "Private rota",
      description: "Still being prepared",
      type: "table",
      content: {
        kind: "table",
        columns: ["Day", "Team"],
        showColumnHeaders: false,
        showRowHeaders: false,
        rows: [["Monday", "Opening"]],
      },
      published: false,
    })

    const publicSnapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "test-hub",
      credential: "ABCD-EFGH",
      nowDate: "2026-07-18",
    })
    expect(publicSnapshot.kind).toBe("ready")
    if (publicSnapshot.kind !== "ready")
      throw new Error("Expected public snapshot")
    expect(publicSnapshot.documents.map((document) => document.id)).toEqual([
      "safety-notes",
    ])

    const managerSnapshot = await owner.query(api.hubs.getOwnedSnapshot, {
      nowDate: "2026-07-18",
    })
    if (managerSnapshot.kind !== "ready")
      throw new Error("Expected manager snapshot")
    expect(managerSnapshot.documents).toHaveLength(2)
    expect(
      managerSnapshot.documents.find(
        (document) => document.id === "private-rota"
      )?.content
    ).toMatchObject({
      kind: "table",
      showColumnHeaders: false,
      showRowHeaders: false,
      rowHeaders: ["Row 1"],
    })

    const searchResults = await t.query(api.search.published, {
      hubSlug: "test-hub",
      credential: "ABCD-EFGH",
      query: "emergency",
      nowDate: "2026-07-18",
    })
    expect(searchResults).toMatchObject([
      { id: "safety-notes", type: "Document" },
    ])

    await expect(
      t.withIdentity(otherIdentity).mutation(api.documents.remove, {
        hubId,
        slug: "safety-notes",
      })
    ).rejects.toThrow("Unauthorized")

    await owner.mutation(api.documents.remove, {
      hubId,
      slug: "safety-notes",
    })
    const afterDelete = await owner.query(api.hubs.getOwnedSnapshot, {
      nowDate: "2026-07-18",
    })
    if (afterDelete.kind !== "ready")
      throw new Error("Expected manager snapshot")
    expect(afterDelete.documents.map((document) => document.id)).toEqual([
      "private-rota",
    ])
  })
})

const orgAdminIdentity = {
  ...ownerIdentity,
  o: { id: "org-a", rol: "admin", slg: "workplace-a" },
}
const orgMemberIdentity = {
  subject: "employee-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|employee-a",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}
const otherOrgAdminIdentity = {
  ...otherIdentity,
  o: { id: "org-b", rol: "admin", slg: "workplace-b" },
}

async function createOrganizationHub(
  t: ReturnType<typeof convexTest>,
  identity = orgAdminIdentity,
  slug = "org-hub"
) {
  return await t
    .withIdentity(identity)
    .mutation(api.hubs.createForOrganization, {
      name:
        slug === "other-org-hub"
          ? "Other Organization Hub"
          : "Organization Hub",
      slug,
      accessMode: "public",
      joinCode: "ORGA-NIZE",
      privateToken: "organization-private-token-that-is-long-enough",
      timeZone: "Europe/Tallinn",
      seedDemoContent: false,
    })
}

async function createEmployee(
  t: ReturnType<typeof convexTest>,
  hubId: Id<"hubs">,
  displayName: string,
  email?: string
) {
  return await t.withIdentity(orgAdminIdentity).mutation(api.employees.create, {
    hubId,
    displayName,
    email,
  })
}

describe("Organization employees, claims, and event links", () => {
  test("uses the active Organization and rejects org:member manager writes", async () => {
    const t = convexTest(schema, modules)
    const first = await createOrganizationHub(t)
    await createOrganizationHub(t, otherOrgAdminIdentity, "other-org-hub")

    const adminSnapshot = await t
      .withIdentity(orgAdminIdentity)
      .query(api.hubs.getOwnedSnapshot, {
        nowDate: "2026-07-19",
        organizationHint: "org-a",
      })
    expect(adminSnapshot.kind).toBe("ready")
    if (adminSnapshot.kind === "ready") {
      expect(adminSnapshot.hub.id).toBe(first.hubId)
    }
    await expect(
      t.withIdentity(orgMemberIdentity).mutation(api.content.saveCategory, {
        hubId: first.hubId,
        slug: "forbidden",
        label: "Forbidden",
        iconKey: "general",
        description: "Members cannot write this",
      })
    ).rejects.toThrow("Unauthorized")
    await expect(
      t.withIdentity(otherOrgAdminIdentity).query(api.employees.list, {
        hubId: first.hubId,
      })
    ).rejects.toThrow("Unauthorized")
  })

  test("keeps employee records private while published events expose names only", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(
      t,
      hubId,
      "Marta Manager",
      "marta@example.test"
    )
    await expect(t.query(api.employees.list, { hubId })).rejects.toThrow(
      "Not authenticated"
    )
    await t.withIdentity(orgAdminIdentity).mutation(api.content.saveEvent, {
      hubId,
      slug: "linked-event",
      title: "Linked event",
      description: "Shows a safe employee projection",
      category: "Training",
      start: "2026-07-20T10:00",
      end: "2026-07-20T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
      replaceLegacyResponsiblePerson: true,
    })
    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      credential: "ORGA-NIZE",
      nowDate: "2026-07-19",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(snapshot.events[0].employees).toEqual([
      { displayName: "Marta Manager" },
    ])
    expect(snapshot.events[0].employees[0]).not.toHaveProperty("id")
    expect(JSON.stringify(snapshot.events[0])).not.toContain(
      "marta@example.test"
    )
  })

  test("adds zero or multiple employees idempotently and rejects cross-hub links", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const first = await createEmployee(t, hubId, "First Employee")
    const second = await createEmployee(t, hubId, "Second Employee")
    const otherHub = await createOrganizationHub(
      t,
      otherOrgAdminIdentity,
      "other-org-hub"
    )
    const otherProfile = await t
      .withIdentity(otherOrgAdminIdentity)
      .mutation(api.employees.create, {
        hubId: otherHub.hubId,
        displayName: "Other Employee",
      })
    const admin = t.withIdentity(orgAdminIdentity)
    const event = {
      hubId,
      slug: "team-event",
      title: "Team event",
      description: "Employee relationship test",
      category: "Training" as const,
      start: "2026-07-21T10:00",
      end: "2026-07-21T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      replaceLegacyResponsiblePerson: true,
    }
    await admin.mutation(api.content.saveEvent, {
      ...event,
      employeeProfileIds: [],
    })
    await admin.mutation(api.content.saveEvent, {
      ...event,
      employeeProfileIds: [first, second, first],
    })
    const relations = await t.run((ctx) =>
      ctx.db
        .query("eventEmployees")
        .withIndex("by_hubId_and_eventId", (q) => q.eq("hubId", hubId))
        .take(10)
    )
    expect(relations).toHaveLength(2)
    await expect(
      admin.mutation(api.content.saveEvent, {
        ...event,
        employeeProfileIds: [otherProfile],
      })
    ).rejects.toThrow("does not belong")
  })

  test("hashes, expires, revokes, and single-uses personal claim links", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const firstProfile = await createEmployee(t, hubId, "Claim Employee")
    const secondProfile = await createEmployee(t, hubId, "Second Claim")
    const admin = t.withIdentity(orgAdminIdentity)
    const token = "personal-claim-token-with-more-than-thirty-two-characters"
    const linkId = await admin.mutation(api.employees.createClaimLink, {
      profileId: firstProfile,
      credential: token,
      expiresAt: Date.now() + 60_000,
    })
    const stored = await t.run((ctx) =>
      ctx.db.get("employeeClaimLinks", linkId)
    )
    expect(stored?.credentialHash).not.toBe(token)
    expect(
      await t.query(api.employees.previewClaim, {
        credential: token,
        now: Date.now() + 120_000,
      })
    ).toEqual({ kind: "invalid" })

    const validToken = "another-personal-claim-token-that-is-long-enough"
    await admin.mutation(api.employees.createClaimLink, {
      profileId: firstProfile,
      credential: validToken,
      expiresAt: Date.now() + 60_000,
    })
    await t
      .withIdentity(orgMemberIdentity)
      .mutation(api.employees.completeClaim, { credential: validToken })
    const otherMember = {
      ...orgMemberIdentity,
      subject: "employee-b",
      tokenIdentifier: "https://clerk.example.test|employee-b",
    }
    await expect(
      t.withIdentity(otherMember).mutation(api.employees.completeClaim, {
        credential: validToken,
      })
    ).rejects.toThrow("already used")

    const secondToken = "second-profile-claim-token-that-is-long-enough"
    await admin.mutation(api.employees.createClaimLink, {
      profileId: secondProfile,
      credential: secondToken,
      expiresAt: Date.now() + 60_000,
    })
    await expect(
      t.withIdentity(orgMemberIdentity).mutation(api.employees.completeClaim, {
        credential: secondToken,
      })
    ).rejects.toThrow("already has an active profile")

    const revokedToken = "revoked-personal-claim-token-that-is-long-enough"
    const revokedId = await admin.mutation(api.employees.createClaimLink, {
      profileId: secondProfile,
      credential: revokedToken,
      expiresAt: Date.now() + 60_000,
    })
    await admin.mutation(api.employees.revokeClaimLink, {
      claimLinkId: revokedId,
    })
    expect(
      await t.query(api.employees.previewClaim, {
        credential: revokedToken,
        now: Date.now(),
      })
    ).toEqual({ kind: "invalid" })
  })

  test("links invitation metadata idempotently for existing and new Clerk users", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const admin = t.withIdentity(orgAdminIdentity)
    const existingProfile = await createEmployee(
      t,
      hubId,
      "Existing Account",
      "existing@example.test"
    )
    const existingCredential =
      "existing-account-invitation-correlation-credential"
    await admin.mutation(api.employees.prepareInvitation, {
      profileId: existingProfile,
      correlationCredential: existingCredential,
    })
    await admin.mutation(api.employees.recordInvitation, {
      profileId: existingProfile,
      invitationId: "inv_existing",
    })
    await t
      .withIdentity(orgMemberIdentity)
      .mutation(api.employees.claimByInvitation, {
        correlationCredential: existingCredential,
      })
    await t
      .withIdentity(orgMemberIdentity)
      .mutation(api.employees.claimByInvitation, {
        correlationCredential: existingCredential,
      })

    const newProfile = await createEmployee(
      t,
      hubId,
      "New Account",
      "new@example.test"
    )
    const newCredential = "new-account-invitation-correlation-credential-value"
    await admin.mutation(api.employees.prepareInvitation, {
      profileId: newProfile,
      correlationCredential: newCredential,
    })
    const newMember = {
      ...orgMemberIdentity,
      subject: "employee-new",
      tokenIdentifier: "https://clerk.example.test|employee-new",
    }
    await t.withIdentity(newMember).mutation(api.employees.claimByInvitation, {
      correlationCredential: newCredential,
    })
    const profiles = await admin.query(api.employees.list, { hubId })
    expect(
      profiles.find((profile) => profile.id === existingProfile)
    ).toMatchObject({
      status: "active",
      clerkUserId: "employee-a",
      invitationStatus: "accepted",
    })
    expect(profiles.find((profile) => profile.id === newProfile)).toMatchObject(
      {
        status: "active",
        clerkUserId: "employee-new",
        invitationStatus: "accepted",
      }
    )
  })

  test("never treats the shared join code as an employee claim credential", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    await createEmployee(t, hubId, "Unclaimed Employee")
    expect(
      await t.query(api.employees.previewClaim, {
        credential: "ORGA-NIZE",
        now: Date.now(),
      })
    ).toEqual({ kind: "invalid" })
    await expect(
      t.withIdentity(orgMemberIdentity).mutation(api.employees.completeClaim, {
        credential: "ORGA-NIZE",
      })
    ).rejects.toThrow("invalid")
  })

  test("deactivation preserves event history and excludes the employee from new links", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(t, hubId, "Historical Employee")
    const admin = t.withIdentity(orgAdminIdentity)
    const event = {
      hubId,
      slug: "historical-event",
      title: "Historical event",
      description: "Keeps its employee display",
      category: "Training" as const,
      start: "2026-07-22T10:00",
      end: "2026-07-22T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
      replaceLegacyResponsiblePerson: true,
    }
    await admin.mutation(api.content.saveEvent, event)
    await admin.mutation(api.employees.deactivateAfterClerkRemoval, {
      profileId,
    })
    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      credential: "ORGA-NIZE",
      nowDate: "2026-07-19",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(snapshot.events[0].employees[0].displayName).toBe(
      "Historical Employee"
    )
    await admin.mutation(api.content.saveEvent, {
      ...event,
      employeeProfileIds: [],
    })
    await expect(admin.mutation(api.content.saveEvent, event)).rejects.toThrow(
      "Deactivated employees"
    )
  })

  test("blocks a deactivated linked member even while a stale token names the Organization", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(t, hubId, "Departed Employee")
    const admin = t.withIdentity(orgAdminIdentity)
    const credential = "departed-employee-personal-claim-credential-value"
    await admin.mutation(api.employees.createClaimLink, {
      profileId,
      credential,
      expiresAt: Date.now() + 60_000,
    })
    await t
      .withIdentity(orgMemberIdentity)
      .mutation(api.employees.completeClaim, { credential })
    expect(
      (
        await t
          .withIdentity(orgMemberIdentity)
          .query(api.hubs.getActiveMemberSnapshot, {
            nowDate: "2026-07-19",
            organizationHint: "org-a",
          })
      ).kind
    ).toBe("ready")
    await admin.mutation(api.employees.deactivateAfterClerkRemoval, {
      profileId,
    })
    expect(
      (
        await t
          .withIdentity(orgMemberIdentity)
          .query(api.hubs.getActiveMemberSnapshot, {
            nowDate: "2026-07-19",
            organizationHint: "org-a",
          })
      ).kind
    ).toBe("deactivated")
  })

  test("preserves and deliberately replaces legacy responsible-person text", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const admin = t.withIdentity(orgAdminIdentity)
    const base = {
      hubId,
      slug: "legacy-event",
      title: "Legacy event",
      description: "Migration test",
      category: "Training" as const,
      start: "2026-07-23T10:00",
      end: "2026-07-23T11:00",
      location: "Office",
      owner: "Legacy Manager",
      notes: "",
      published: true,
      guideSlugs: [],
    }
    await admin.mutation(api.content.saveEvent, base)
    let snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      credential: "ORGA-NIZE",
      nowDate: "2026-07-19",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(snapshot.events[0].legacyResponsiblePerson).toBe("Legacy Manager")
    await admin.mutation(api.content.saveEvent, {
      ...base,
      owner: undefined,
      employeeProfileIds: [],
      replaceLegacyResponsiblePerson: true,
    })
    snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      credential: "ORGA-NIZE",
      nowDate: "2026-07-19",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(snapshot.events[0].legacyResponsiblePerson).toBeUndefined()
  })

  test("searches events through employee relations without depending on owner", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(t, hubId, "Searchable Employee")
    await t.withIdentity(orgAdminIdentity).mutation(api.content.saveEvent, {
      hubId,
      slug: "search-event",
      title: "Team briefing",
      description: "Normal event",
      category: "Training",
      start: "2026-07-24T10:00",
      end: "2026-07-24T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
      replaceLegacyResponsiblePerson: true,
    })
    const results = await t.query(api.search.published, {
      hubSlug: "org-hub",
      credential: "ORGA-NIZE",
      query: "Searchable Employee",
      nowDate: "2026-07-19",
    })
    expect(results.map((result) => result.id)).toContain("search-event")
  })

  test("deletes event employee links and deduplicates webhook delivery", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(t, hubId, "Delete Link Employee")
    const admin = t.withIdentity(orgAdminIdentity)
    await admin.mutation(api.content.saveEvent, {
      hubId,
      slug: "delete-event",
      title: "Delete event",
      description: "Deletion test",
      category: "Training",
      start: "2026-07-24T10:00",
      end: "2026-07-24T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
      replaceLegacyResponsiblePerson: true,
    })
    await admin.mutation(api.content.deleteEvent, {
      hubId,
      slug: "delete-event",
    })
    expect(
      await t.run((ctx) => ctx.db.query("eventEmployees").take(10))
    ).toHaveLength(0)
    const webhook = {
      eventId: "evt_once",
      eventType: "organizationInvitation.revoked",
      invitationId: "inv_missing",
      invitationStatus: "revoked" as const,
    }
    await t.mutation(internal.employees.applyClerkWebhook, webhook)
    await t.mutation(internal.employees.applyClerkWebhook, webhook)
    expect(
      await t.run((ctx) => ctx.db.query("clerkWebhookEvents").take(10))
    ).toHaveLength(1)
  })

  test("maps an existing owner hub idempotently without deleting legacy ownership", async () => {
    const t = convexTest(schema, modules)
    const legacy = await createHub(t)
    const first = await t
      .withIdentity(orgAdminIdentity)
      .mutation(api.hubs.createForOrganization, {
        name: "Ignored",
        slug: "ignored",
        accessMode: "public",
        joinCode: "ORGA-NIZE",
        privateToken: "organization-private-token-that-is-long-enough",
        timeZone: "Europe/Tallinn",
        seedDemoContent: false,
      })
    const second = await t
      .withIdentity(orgAdminIdentity)
      .mutation(api.hubs.createForOrganization, {
        name: "Ignored",
        slug: "ignored",
        accessMode: "public",
        joinCode: "ORGA-NIZE",
        privateToken: "organization-private-token-that-is-long-enough",
        timeZone: "Europe/Tallinn",
        seedDemoContent: false,
      })
    expect(first.hubId).toBe(legacy.hubId)
    expect(second.hubId).toBe(legacy.hubId)
    const stored = await t.run((ctx) => ctx.db.get("hubs", legacy.hubId))
    expect(stored?.clerkOrganizationId).toBe("org-a")
    expect(stored?.ownerTokenIdentifier).toBe(ownerIdentity.tokenIdentifier)
  })
})

describe("notification feeds", () => {
  test("tracks anonymous and manager unread state independently", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t, { restricted: true })
    const owner = t.withIdentity(ownerIdentity)
    const firstDevice = "guest-device-0000000000000001"
    const secondDevice = "guest-device-0000000000000002"
    const employeeArgs = {
      hubSlug: "test-hub",
      credential: "ABCD-EFGH",
      guestDeviceId: firstDevice,
    }

    await owner.mutation(api.content.saveCategory, {
      hubId,
      slug: "operations",
      label: "Operations",
      iconKey: "general",
      description: "Operational guides",
    })
    await t.mutation(api.notifications.markEmployeeRead, employeeArgs)
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "opening",
      title: "Opening checklist",
      description: "Open the workplace safely",
      categorySlug: "operations",
      duration: "4 min",
      featured: true,
      published: true,
      keywords: [],
      content: { type: "doc", content: [] },
    })

    const firstFeed = await t.query(
      api.notifications.listEmployee,
      employeeArgs
    )
    expect(firstFeed.unreadCount).toBe(1)
    expect(firstFeed.notifications[0]?.title).toBe("New guide published")

    const secondFeed = await t.query(api.notifications.listEmployee, {
      ...employeeArgs,
      guestDeviceId: secondDevice,
    })
    expect(secondFeed.unreadCount).toBe(1)

    await t.mutation(api.content.submitHelpRequest, {
      hubSlug: "test-hub",
      credential: "ABCD-EFGH",
      topic: "Opening question",
      message: "Where is the key?",
    })
    const managerFeed = await owner.query(api.notifications.listManager, {
      hubId,
    })
    expect(managerFeed.unreadCount).toBe(1)
    expect(managerFeed.notifications[0]?.href).toBe("/manager/help")
    await owner.mutation(api.notifications.markManagerRead, { hubId })
    expect(
      (await owner.query(api.notifications.listManager, { hubId })).unreadCount
    ).toBe(0)

    await expect(
      t.query(api.notifications.listEmployee, {
        hubSlug: "test-hub",
        credential: "wrong",
        guestDeviceId: firstDevice,
      })
    ).rejects.toThrow("Hub access required")
  })

  test("adds personal assignment alerts only for the assigned employee", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(t, hubId, "Assigned Employee")
    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", profileId, {
        clerkUserId: orgMemberIdentity.subject,
        status: "active",
        invitationStatus: "accepted",
      })
    })
    await t.withIdentity(orgAdminIdentity).mutation(api.content.saveEvent, {
      hubId,
      slug: "team-training",
      title: "Team training",
      description: "A required training session",
      category: "Training",
      start: "2026-07-25T10:00",
      end: "2026-07-25T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
      replaceLegacyResponsiblePerson: true,
    })

    const memberFeed = await t
      .withIdentity(orgMemberIdentity)
      .query(api.notifications.listEmployee, {
        hubSlug: "org-hub",
        guestDeviceId: "unused-for-an-authenticated-member",
      })
    expect(memberFeed.notifications.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        "New event added",
        "You were assigned to an event",
      ])
    )

    const guestFeed = await t.query(api.notifications.listEmployee, {
      hubSlug: "org-hub",
      credential: "ORGA-NIZE",
      guestDeviceId: "guest-device-0000000000000003",
    })
    expect(
      guestFeed.notifications.some(
        (item) => item.title === "You were assigned to an event"
      )
    ).toBe(false)
  })

  test("only alerts employees whose event assignments were saved", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileIds = await t.run(async (ctx) => {
      const ids: Id<"employeeProfiles">[] = []
      for (let index = 0; index < 101; index += 1) {
        ids.push(
          await ctx.db.insert("employeeProfiles", {
            hubId,
            displayName: `Employee ${index + 1}`,
            status: "unclaimed",
            createdBy: orgAdminIdentity.subject,
            createdAt: index,
            updatedAt: index,
            invitationStatus: "not-sent",
          })
        )
      }
      return ids
    })

    await t.withIdentity(orgAdminIdentity).mutation(api.content.saveEvent, {
      hubId,
      slug: "capacity-training",
      title: "Capacity training",
      description: "Assignment limit regression test",
      category: "Training",
      start: "2026-07-26T10:00",
      end: "2026-07-26T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: profileIds,
      replaceLegacyResponsiblePerson: true,
    })

    const [relations, personalNotifications] = await t.run(
      async (ctx) =>
        await Promise.all([
          ctx.db
            .query("eventEmployees")
            .withIndex("by_hubId_and_eventId", (q) => q.eq("hubId", hubId))
            .take(200),
          ctx.db
            .query("notifications")
            .withIndex("by_hubId_and_audience", (q) =>
              q.eq("hubId", hubId).eq("audience", "employee")
            )
            .take(200),
        ])
    )
    expect(relations).toHaveLength(100)
    expect(personalNotifications).toHaveLength(100)
  })
})
