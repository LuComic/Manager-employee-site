/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import { describe, expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"
import { RESERVATION_EVENT_TYPE_ID } from "../lib/categories"

const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "owner-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-a",
  o: { id: "org-a", rol: "admin", slg: "workplace-a" },
}
const otherIdentity = {
  subject: "owner-b",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-b",
  o: { id: "org-b", rol: "admin", slg: "workplace-b" },
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
  })
}

async function createRegisteredUpload(
  t: ReturnType<typeof convexTest>,
  args: {
    hubId: Id<"hubs">
    identity: typeof ownerIdentity
    blob: Blob
  }
) {
  const bytes = new Uint8Array(await args.blob.arrayBuffer())
  const owner = t.withIdentity(args.identity)
  const intent = await owner.mutation(api.files.generateUploadUrl, {
    hubId: args.hubId,
    sha256: bytesToHex(sha256(bytes)),
    size: args.blob.size,
  })
  const storageId = await t.run(async (ctx) => {
    return await ctx.storage.store(args.blob)
  })
  await owner.mutation(api.files.registerUpload, {
    hubId: args.hubId,
    uploadIntentId: intent.uploadIntentId,
    storageId,
  })
  return storageId
}

describe("hub authorization and anonymous access", () => {
  test("isolates manager data by Clerk owner", async () => {
    const t = convexTest(schema, modules)
    await createHub(t)

    expect(
      (
        await t
          .withIdentity(ownerIdentity)
          .query(api.hubs.getManagerSnapshot, { nowDate: "2026-07-18" })
      ).kind
    ).toBe("ready")
    expect(
      (
        await t
          .withIdentity(otherIdentity)
          .query(api.hubs.getManagerSnapshot, { nowDate: "2026-07-18" })
      ).kind
    ).toBe("none")
  })

  test("initializes only required records and one reservation example", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const initialized = await t.run(async (ctx) => {
      const [
        hub,
        credentials,
        categories,
        guides,
        events,
        announcements,
        faqs,
        documents,
        employees,
        workerNotes,
        notifications,
      ] = await Promise.all([
        ctx.db.get("hubs", hubId),
        ctx.db
          .query("hubCredentials")
          .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
          .unique(),
        ctx.db
          .query("categories")
          .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hubId))
          .take(2),
        ctx.db.query("guides").take(1),
        ctx.db.query("events").take(1),
        ctx.db.query("announcements").take(1),
        ctx.db.query("faqs").take(1),
        ctx.db.query("documents").take(1),
        ctx.db.query("employeeProfiles").take(1),
        ctx.db.query("workerNotes").take(1),
        ctx.db.query("notifications").take(1),
      ])
      return {
        hub,
        credentials,
        categories,
        emptyContentCounts: {
          guides: guides.length,
          events: events.length,
          announcements: announcements.length,
          faqs: faqs.length,
          documents: documents.length,
          employees: employees.length,
          workerNotes: workerNotes.length,
          notifications: notifications.length,
        },
      }
    })

    expect(initialized.credentials).not.toBeNull()
    expect(initialized.categories).toHaveLength(1)
    expect(initialized.categories[0]).toMatchObject({
      slug: RESERVATION_EVENT_TYPE_ID,
      label: "Broneering",
      kind: "event",
    })
    expect(initialized.emptyContentCounts).toEqual({
      guides: 0,
      events: 0,
      announcements: 0,
      faqs: 0,
      documents: 0,
      employees: 0,
      workerNotes: 0,
      notifications: 0,
    })
    expect(initialized.hub?.todaySections).toHaveLength(6)
    expect(
      new Set(initialized.hub?.todaySections?.map((section) => section.key))
        .size
    ).toBe(initialized.hub?.todaySections?.length)

    await expect(
      t.withIdentity(ownerIdentity).mutation(api.content.saveCategory, {
        hubId,
        slug: ` ${RESERVATION_EVENT_TYPE_ID} `,
        label: "Guide collision",
        iconKey: "general",
        description: "Cannot reuse an event type slug",
        kind: "guide",
      })
    ).rejects.toThrow("categoryTypeCannotChange")
  })

  test("keeps used event types and deletes unused types regardless of event count", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)
    await owner.mutation(api.content.saveCategory, {
      hubId,
      slug: "event-inventory",
      label: "Inventory count",
      iconKey: "general",
      description: "",
      kind: "event",
    })
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "inventory-count",
      title: "Inventory count",
      description: "Uses a manager-defined event type",
      category: "event-inventory",
      start: "2026-08-02T10:00",
      end: "2026-08-02T11:00",
      location: "Stockroom",
      notes: "",
      published: false,
      guideSlugs: [],
    })
    const inventoryType = await t.run(
      async (ctx) =>
        await ctx.db
          .query("categories")
          .withIndex("by_hubId_and_slug", (q) =>
            q.eq("hubId", hubId).eq("slug", "event-inventory")
          )
          .unique()
    )
    expect(inventoryType).not.toBeNull()
    const inventoryEvent = await t.run(
      async (ctx) =>
        await ctx.db
          .query("events")
          .withIndex("by_hubId_and_slug", (q) =>
            q.eq("hubId", hubId).eq("slug", "inventory-count")
          )
          .unique()
    )
    expect(inventoryEvent?.categoryId).toBe(inventoryType?._id)
    await expect(
      owner.mutation(api.content.deleteCategory, {
        hubId,
        slug: "event-inventory",
        kind: "event",
      })
    ).rejects.toThrow("reassignEventsBeforeDeletingThisCategory")

    await owner.mutation(api.content.saveCategory, {
      hubId,
      slug: "event-unused",
      label: "Unused",
      iconKey: "general",
      description: "",
      kind: "event",
    })
    const reservationType = await t.run(
      async (ctx) =>
        await ctx.db
          .query("categories")
          .withIndex("by_hubId_and_slug", (q) =>
            q.eq("hubId", hubId).eq("slug", RESERVATION_EVENT_TYPE_ID)
          )
          .unique()
    )
    expect(reservationType).not.toBeNull()
    await t.run(async (ctx) => {
      for (let index = 0; index < 501; index += 1) {
        await ctx.db.insert("events", {
          hubId,
          slug: `historical-${index}`,
          title: `Historical event ${index}`,
          description: "Historical event",
          categoryId: reservationType!._id,
          start: `2025-01-01T${String(index % 24).padStart(2, "0")}:00`,
          end: `2025-01-01T${String((index + 1) % 24).padStart(2, "0")}:00`,
          location: "Office",
          notes: "",
          published: false,
        })
      }
    })
    await expect(
      owner.mutation(api.content.deleteCategory, {
        hubId,
        slug: "event-unused",
        kind: "event",
      })
    ).resolves.toBeNull()
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

  test("encrypts access credentials and makes them available only to the workplace owner", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t, { restricted: true })

    const stored = await t.run(async (ctx) => {
      return await ctx.db
        .query("hubCredentials")
        .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
        .unique()
    })
    expect(stored).toMatchObject({
      hubId,
      credentialVersion: 1,
    })
    expect(stored).not.toHaveProperty("joinCode")
    expect(stored).not.toHaveProperty("privateToken")
    expect(stored?.ciphertext).not.toContain("ABCD-EFGH")
    expect(stored?.ciphertext).not.toContain("private-token")
    expect(stored?.initializationVector).toMatch(/^[\da-f]{24}$/)

    await expect(
      t.withIdentity(ownerIdentity).query(api.hubs.getOwnerCredentials, {
        hubId,
      })
    ).resolves.toEqual({
      joinCode: "ABCD-EFGH",
      privateToken: "private-token-that-is-at-least-thirty-two-characters",
      credentialVersion: 1,
    })
    await expect(
      t.withIdentity(otherIdentity).query(api.hubs.getOwnerCredentials, {
        hubId,
      })
    ).rejects.toThrow("unauthorized")
    await expect(
      t.query(api.hubs.getOwnerCredentials, { hubId })
    ).rejects.toThrow("notAuthenticated")
  })

  test("rejects missing or tampered owner credentials as an invariant failure", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t, { restricted: true })
    const owner = t.withIdentity(ownerIdentity)

    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query("hubCredentials")
        .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
        .unique()
      if (!stored) throw new Error("Expected credentials")
      await ctx.db.patch("hubCredentials", stored._id, {
        ciphertext: `${stored.ciphertext[0] === "0" ? "1" : "0"}${stored.ciphertext.slice(1)}`,
      })
    })
    await expect(
      owner.query(api.hubs.getOwnerCredentials, { hubId })
    ).rejects.toThrow("hubCredentialsUnavailable")

    await t.run(async (ctx) => {
      const stored = await ctx.db
        .query("hubCredentials")
        .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
        .unique()
      if (stored) await ctx.db.delete("hubCredentials", stored._id)
    })
    await expect(
      owner.query(api.hubs.getOwnerCredentials, { hubId })
    ).rejects.toThrow("hubCredentialsUnavailable")
  })

  test("switches public and restricted accountless access", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)

    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("ready")

    await owner.mutation(api.hubs.setAccessMode, {
      hubId,
      accessMode: "restricted",
    })
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
          credential: "ABCD-EFGH",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("ready")

    await owner.mutation(api.hubs.setAccessMode, {
      hubId,
      accessMode: "public",
    })
    expect(
      (
        await t.query(api.hubs.getPublicSnapshot, {
          slug: "test-hub",
          nowDate: "2026-07-18",
        })
      ).kind
    ).toBe("ready")
  })

  test("credential rotation revokes old codes and links", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t, { restricted: true })
    await expect(
      t.withIdentity(ownerIdentity).mutation(api.hubs.rotateCredentials, {
        hubId,
        joinCode: "JKLM-NPQR",
        privateToken: "replacement-private-token-that-is-long-enough-123",
      })
    ).resolves.toBeNull()

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
    await expect(
      t.withIdentity(ownerIdentity).query(api.hubs.getOwnerCredentials, {
        hubId,
      })
    ).resolves.toEqual({
      joinCode: "JKLM-NPQR",
      privateToken: "replacement-private-token-that-is-long-enough-123",
      credentialVersion: 2,
    })
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
        kind: "guide",
      })
    ).rejects.toThrow("unauthorized")
  })

  test("always publishes managed FAQs and keeps help requests owner-only", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)

    await owner.mutation(api.content.saveFaq, {
      hubId,
      slug: "where-are-keys",
      question: "Where are the keys?",
      answer: "Ask the opening manager.",
    })
    const faq = await t.run(async (ctx) => {
      return await ctx.db
        .query("faqs")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "where-are-keys")
        )
        .unique()
    })
    expect(faq?.published).toBe(true)
    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "test-hub",
      credential: "ABCD-EFGH",
      nowDate: "2026-07-18",
    })
    expect(snapshot.kind).toBe("ready")
    if (snapshot.kind === "ready") {
      expect(snapshot.faqs).toHaveLength(1)
      expect(snapshot.faqs[0]).not.toHaveProperty("published")
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
    ).rejects.toThrow("unauthorized")
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
      kind: "guide",
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
      relatedGuideSlugs: ["published-guide"],
      content,
    })
    await expect(
      owner.mutation(api.content.saveGuide, {
        hubId,
        slug: "invalid-related-guide",
        title: "Invalid related guide",
        description: "Draft guides cannot be linked",
        categorySlug: "ops",
        duration: "3 min",
        featured: false,
        published: true,
        keywords: [],
        relatedGuideSlugs: ["draft-guide"],
        content,
      })
    ).rejects.toThrow("relatedGuidesMustBePublished")
    await expect(
      owner.mutation(api.content.saveAnnouncement, {
        hubId,
        slug: "invalid-related-announcement",
        title: "Invalid related announcement",
        content,
        publishedAt: "2026-07-18",
        expiresAt: "2026-07-20",
        priority: "Normal",
        pinned: false,
        published: true,
        guideSlug: "draft-guide",
      })
    ).rejects.toThrow("relatedGuidesMustBePublished")
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "event",
      title: "Event",
      description: "Visible event",
      category: "event-reservation",
      start: "2026-07-19T10:00",
      end: "2026-07-19T11:00",
      location: "Office",
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
    const managerBefore = await owner.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-07-18",
    })
    if (managerBefore.kind !== "ready")
      throw new Error("Expected manager snapshot")
    expect(
      managerBefore.guides.find((guide) => guide.id === "draft-guide")
        ?.relatedGuideIds
    ).toEqual(["published-guide"])

    await owner.mutation(api.content.deleteGuide, {
      hubId,
      slug: "published-guide",
    })
    const managerAfter = await owner.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-07-18",
    })
    if (managerAfter.kind !== "ready")
      throw new Error("Expected manager snapshot")
    expect(managerAfter.events[0].guideIds).toEqual([])
    expect(managerAfter.announcements[0].guideId).toBeUndefined()
    expect(managerAfter.guides[0]?.relatedGuideIds).toEqual([])
  })

  test("documents enforce ownership, draft visibility, search, and deletion", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)
    await owner.mutation(api.content.saveCategory, {
      hubId,
      slug: "safety",
      label: "Safety",
      iconKey: "general",
      description: "Safety guides",
      kind: "guide",
    })
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "emergency-guide",
      title: "Related guide",
      description: "General instructions",
      categorySlug: "safety",
      duration: "5 min",
      featured: false,
      published: true,
      keywords: [],
      content: { type: "doc", content: [] },
    })
    const employeeProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Safety Lead",
    })
    const storageId = await createRegisteredUpload(t, {
      hubId,
      identity: ownerIdentity,
      blob: new Blob(["Monday,Opening"], { type: "text/csv" }),
    })

    await owner.mutation(api.documents.save, {
      hubId,
      slug: "safety-notes",
      title: "Safety notes",
      description: "Important emergency information",
      resource: {
        kind: "link",
        url: "https://docs.google.com/document/d/safety-notes",
      },
      bannerStorageId: null,
      employeeProfileIds: [employeeProfileId],
      relatedGuideSlugs: ["emergency-guide"],
      published: true,
    })
    await owner.mutation(api.documents.save, {
      hubId,
      slug: "private-rota",
      title: "Private rota",
      description: "Still being prepared",
      resource: {
        kind: "file",
        storageId,
        name: "rota.csv",
        contentType: "text/csv",
      },
      bannerStorageId: null,
      employeeProfileIds: [],
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

    const managerSnapshot = await owner.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-07-18",
    })
    if (managerSnapshot.kind !== "ready")
      throw new Error("Expected manager snapshot")
    expect(managerSnapshot.documents).toHaveLength(2)
    expect(
      managerSnapshot.documents.find(
        (document) => document.id === "private-rota"
      )?.resource
    ).toMatchObject({
      kind: "file",
      name: "rota.csv",
      contentType: "text/csv",
      size: 14,
    })
    expect(
      managerSnapshot.documents.find(
        (document) => document.id === "private-rota"
      )?.resource
    ).not.toHaveProperty("storageId")
    expect(
      managerSnapshot.documents.find(
        (document) => document.id === "safety-notes"
      )?.employees
    ).toEqual([{ id: employeeProfileId, displayName: "Safety Lead" }])
    expect(
      managerSnapshot.documents.find(
        (document) => document.id === "safety-notes"
      )?.relatedGuideIds
    ).toEqual(["emergency-guide"])

    const searchResults = await t.query(api.search.published, {
      hubSlug: "test-hub",
      credential: "ABCD-EFGH",
      query: "emergency",
      nowDate: "2026-07-18",
    })
    expect(searchResults).toMatchObject([
      { id: "safety-notes", type: "Document" },
    ])
    const employeeSearchResults = await t.query(api.search.published, {
      hubSlug: "test-hub",
      credential: "ABCD-EFGH",
      query: "Safety Lead",
      nowDate: "2026-07-18",
    })
    expect(employeeSearchResults).toMatchObject([
      { id: "safety-notes", type: "Document" },
    ])

    await expect(
      t.withIdentity(otherIdentity).mutation(api.documents.remove, {
        hubId,
        slug: "safety-notes",
      })
    ).rejects.toThrow("unauthorized")

    await owner.mutation(api.documents.remove, {
      hubId,
      slug: "safety-notes",
    })
    const afterDelete = await owner.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-07-18",
    })
    if (afterDelete.kind !== "ready")
      throw new Error("Expected manager snapshot")
    expect(afterDelete.documents.map((document) => document.id)).toEqual([
      "private-rota",
    ])
    expect(
      await t.run((ctx) => ctx.db.query("documentGuides").take(10))
    ).toHaveLength(0)
  })

  test("binds uploads to one workplace and protects attached files", async () => {
    const t = convexTest(schema, modules)
    const first = await createHub(t)
    const second = await createHub(t, {
      identity: otherIdentity,
      slug: "other",
    })
    const firstOwner = t.withIdentity(ownerIdentity)
    const secondOwner = t.withIdentity(otherIdentity)
    const storageId = await createRegisteredUpload(t, {
      hubId: first.hubId,
      identity: ownerIdentity,
      blob: new Blob(["private workplace file"], {
        type: "text/plain",
      }),
    })
    const resource = {
      kind: "file" as const,
      storageId,
      name: "private.txt",
      contentType: "text/plain",
    }

    await expect(
      secondOwner.mutation(api.documents.save, {
        hubId: second.hubId,
        slug: "stolen-file",
        title: "Stolen file",
        description: "Must not attach across workplaces",
        resource,
        employeeProfileIds: [],
        published: true,
      })
    ).rejects.toThrow("fileNotBelongWorkplace")
    await expect(
      secondOwner.mutation(api.files.discardUpload, {
        hubId: second.hubId,
        storageId,
      })
    ).rejects.toThrow("fileNotBelongWorkplace")

    await firstOwner.mutation(api.documents.save, {
      hubId: first.hubId,
      slug: "owned-file",
      title: "Owned file",
      description: "Safe workplace file",
      resource,
      employeeProfileIds: [],
      published: true,
    })
    await expect(
      firstOwner.mutation(api.files.discardUpload, {
        hubId: first.hubId,
        storageId,
      })
    ).rejects.toThrow("fileIsAlreadyInUse")

    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "test-hub",
      nowDate: "2026-07-18",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(snapshot.documents[0]?.resource).not.toHaveProperty("storageId")

    await firstOwner.mutation(api.documents.remove, {
      hubId: first.hubId,
      slug: "owned-file",
    })
    expect(
      await t.run((ctx) => ctx.db.system.get("_storage", storageId))
    ).toBeNull()
    expect(
      await t.run((ctx) => ctx.db.query("hubStorage").take(10))
    ).toHaveLength(0)
  })
})

const orgAdminIdentity = {
  ...ownerIdentity,
}
const orgMemberIdentity = {
  subject: "employee-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|employee-a",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}
const editorIdentity = {
  subject: "employee-editor",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|employee-editor",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}
const appManagerIdentity = {
  subject: "employee-manager",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|employee-manager",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}
const otherOrgAdminIdentity = {
  ...otherIdentity,
}

async function createOrganizationHub(
  t: ReturnType<typeof convexTest>,
  identity = orgAdminIdentity,
  slug = "org-hub"
) {
  return await t.withIdentity(identity).mutation(api.hubs.create, {
    name:
      slug === "other-org-hub" ? "Other Organization Hub" : "Organization Hub",
    slug,
    accessMode: "public",
    joinCode: "ORGA-NIZE",
    privateToken: "organization-private-token-that-is-long-enough",
    timeZone: "Europe/Tallinn",
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

describe("Organization employees, invitations, and event links", () => {
  test("uses the active Organization and rejects org:member manager writes", async () => {
    const t = convexTest(schema, modules)
    const first = await createOrganizationHub(t)
    await createOrganizationHub(t, otherOrgAdminIdentity, "other-org-hub")

    const adminSnapshot = await t
      .withIdentity(orgAdminIdentity)
      .query(api.hubs.getManagerSnapshot, {
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
        kind: "guide",
      })
    ).rejects.toThrow("unauthorized")
    await expect(
      t.withIdentity(otherOrgAdminIdentity).query(api.employees.list, {
        hubId: first.hubId,
      })
    ).rejects.toThrow("unauthorized")
  })

  test("separates read-only, editing, full-content, and owner access", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const admin = t.withIdentity(orgAdminIdentity)
    const viewerProfileId = await admin.mutation(api.employees.create, {
      hubId,
      displayName: "Read Only",
      email: "private-viewer@example.test",
      accessLevel: "viewer",
    })
    const editorProfileId = await admin.mutation(api.employees.create, {
      hubId,
      displayName: "Content Editor",
      accessLevel: "editor",
    })
    await admin.mutation(api.employees.create, {
      hubId,
      displayName: "App Manager",
      accessLevel: "manager",
    })
    await admin.mutation(api.content.saveCategory, {
      hubId,
      slug: "service",
      label: "Service",
      iconKey: "general",
      description: "Existing category",
      kind: "guide",
    })
    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", viewerProfileId, {
        clerkUserId: orgMemberIdentity.subject,
        status: "active",
      })
      await ctx.db.patch("employeeProfiles", editorProfileId, {
        clerkUserId: editorIdentity.subject,
        status: "active",
      })
      const managerProfile = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_hubId_and_displayName", (q) =>
          q.eq("hubId", hubId).eq("displayName", "App Manager")
        )
        .unique()
      if (!managerProfile) throw new Error("Manager profile not found")
      await ctx.db.patch("employeeProfiles", managerProfile._id, {
        clerkUserId: appManagerIdentity.subject,
        status: "active",
      })
    })

    const viewerSnapshot = await t
      .withIdentity(orgMemberIdentity)
      .query(api.hubs.getManagerSnapshot, { nowDate: "2026-07-19" })
    expect(viewerSnapshot.kind).toBe("forbidden")
    expect(
      await t
        .withIdentity(orgMemberIdentity)
        .query(api.hubs.getManagerAccess, { organizationHint: "org-a" })
    ).toBeNull()
    await expect(
      t.withIdentity(orgMemberIdentity).mutation(api.content.saveCategory, {
        hubId,
        slug: "service",
        label: "Viewer edit",
        iconKey: "general",
        description: "Must not save",
        kind: "guide",
      })
    ).rejects.toThrow("editingAccessRequired")

    const editor = t.withIdentity(editorIdentity)
    const editorSnapshot = await editor.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-07-19",
    })
    expect(editorSnapshot).toMatchObject({
      kind: "ready",
      managerAccess: "editor",
    })
    expect(
      await editor.query(api.hubs.getManagerAccess, {
        organizationHint: "org-a",
      })
    ).toBe("editor")
    expect(
      await editor.query(api.hubs.getOwnerAuthorization, {
        organizationHint: "org-a",
      })
    ).toEqual({ authorized: false })
    const assignableEmployees = await editor.query(
      api.employees.listAssignable,
      { hubId }
    )
    expect(assignableEmployees[0]).not.toHaveProperty("email")
    expect(assignableEmployees[0]).not.toHaveProperty("accessLevel")
    await editor.mutation(api.content.saveCategory, {
      hubId,
      slug: "service",
      label: "Updated Service",
      iconKey: "general",
      description: "Editors can update existing content",
      kind: "guide",
    })
    await expect(
      editor.mutation(api.content.saveCategory, {
        hubId,
        slug: "new-category",
        label: "New category",
        iconKey: "general",
        description: "Editors cannot create content",
        kind: "guide",
      })
    ).rejects.toThrow("fullContentAccessRequiredCreateContent")
    await expect(
      editor.mutation(api.content.deleteCategory, {
        hubId,
        slug: "service",
        kind: "guide",
      })
    ).rejects.toThrow("fullContentAccessRequired")

    const appManager = t.withIdentity(appManagerIdentity)
    expect(
      await appManager.query(api.hubs.getManagerSnapshot, {
        nowDate: "2026-07-19",
      })
    ).toMatchObject({ kind: "ready", managerAccess: "manager" })
    expect(
      await appManager.query(api.hubs.getManagerAccess, {
        organizationHint: "org-a",
      })
    ).toBe("manager")
    expect(
      await appManager.query(api.hubs.getOwnerAuthorization, {
        organizationHint: "org-a",
      })
    ).toEqual({ authorized: false })
    await appManager.mutation(api.content.saveCategory, {
      hubId,
      slug: "manager-created",
      label: "Manager created",
      iconKey: "general",
      description: "Full access can create content",
      kind: "guide",
    })
    await appManager.mutation(api.content.deleteCategory, {
      hubId,
      slug: "manager-created",
      kind: "guide",
    })
    await expect(
      appManager.mutation(api.employees.update, {
        profileId: viewerProfileId,
        displayName: "Read Only",
        email: "private-viewer@example.test",
        accessLevel: "editor",
      })
    ).rejects.toThrow("workplaceOwnerAccessRequired")
    await expect(
      appManager.mutation(api.hubs.setAccessMode, {
        hubId,
        accessMode: "restricted",
      })
    ).rejects.toThrow("workplaceOwnerAccessRequired")
    await expect(
      appManager.query(api.employees.list, { hubId })
    ).rejects.toThrow("workplaceOwnerAccessRequired")

    expect(
      await admin.query(api.hubs.getOwnerAuthorization, {
        organizationHint: "org-a",
      })
    ).toMatchObject({ authorized: true, hubId })
    expect(
      await admin.query(api.hubs.getManagerAccess, {
        organizationHint: "org-a",
      })
    ).toBe("owner")
    await admin.mutation(api.employees.update, {
      profileId: viewerProfileId,
      displayName: "Read Only",
      email: "private-viewer@example.test",
      accessLevel: "editor",
    })
    const profiles = await admin.query(api.employees.list, { hubId })
    expect(
      profiles.find((profile) => profile.id === viewerProfileId)?.accessLevel
    ).toBe("editor")
  })

  test("lets workers manage only the content sections enabled by a manager", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const owner = t.withIdentity(orgAdminIdentity)
    const workerProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Worker",
      accessLevel: "viewer",
    })
    const managerProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Content Manager",
      accessLevel: "manager",
    })
    const otherWorkerProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Other Worker",
      accessLevel: "viewer",
    })
    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", workerProfileId, {
        clerkUserId: orgMemberIdentity.subject,
        status: "active",
      })
      await ctx.db.patch("employeeProfiles", managerProfileId, {
        clerkUserId: appManagerIdentity.subject,
        status: "active",
      })
      await ctx.db.patch("employeeProfiles", otherWorkerProfileId, {
        status: "active",
      })
    })
    await owner.mutation(api.content.saveCategory, {
      hubId,
      slug: "operations",
      label: "Operations",
      iconKey: "general",
      description: "Operational guides",
      kind: "guide",
    })
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "draft-guide",
      title: "Draft guide",
      description: "Visible to workers only when guide editing is enabled",
      categorySlug: "operations",
      duration: "5 min",
      featured: false,
      published: false,
      keywords: [],
      content: { type: "doc" },
    })
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "unlinked-draft-guide",
      title: "Unlinked draft guide",
      description: "Must remain hidden when guide editing is disabled",
      categorySlug: "operations",
      duration: "3 min",
      featured: false,
      published: false,
      keywords: [],
      content: { type: "doc" },
    })
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "published-guide",
      title: "Published guide",
      description: "Available for related-content links",
      categorySlug: "operations",
      duration: "4 min",
      featured: false,
      published: true,
      keywords: [],
      content: { type: "doc" },
    })
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "draft-event",
      title: "Draft event",
      description: "Must stay outside a guide-only worker snapshot",
      category: "event-reservation",
      start: "2026-08-01T10:00",
      end: "2026-08-01T11:00",
      location: "Office",
      notes: "",
      published: false,
      guideSlugs: ["published-guide"],
      employeeProfileIds: [],
    })
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "unlinked-draft-event",
      title: "Unlinked draft event",
      description: "Must remain hidden when event editing is disabled",
      category: "event-reservation",
      start: "2026-08-02T10:00",
      end: "2026-08-02T11:00",
      location: "Office",
      notes: "",
      published: false,
      guideSlugs: [],
      employeeProfileIds: [],
    })
    await owner.mutation(api.content.saveAnnouncement, {
      hubId,
      slug: "draft-announcement",
      title: "Draft announcement",
      content: { type: "doc" },
      publishedAt: "2026-07-30",
      expiresAt: "2026-08-30",
      priority: "Normal",
      pinned: false,
      published: false,
      guideSlug: "published-guide",
      eventSlug: "draft-event",
    })
    await owner.mutation(api.documents.save, {
      hubId,
      slug: "draft-document",
      title: "Draft document",
      description: "Must stay outside a guide-only worker snapshot",
      resource: { kind: "link", url: "https://example.test/draft" },
      employeeProfileIds: [],
      relatedGuideSlugs: ["published-guide"],
      published: false,
    })

    const worker = t.withIdentity(orgMemberIdentity)
    const manager = t.withIdentity(appManagerIdentity)
    expect(
      await worker.query(api.hubs.getManagerSnapshot, {
        nowDate: "2026-07-30",
      })
    ).toMatchObject({ kind: "forbidden" })

    await manager.mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "guides",
      enabled: true,
    })
    const guideSnapshot = await worker.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-07-30",
    })
    expect(guideSnapshot).toMatchObject({
      kind: "ready",
      managerAccess: "viewer",
      hub: {
        workersCanEdit: {
          guides: true,
          events: false,
          announcements: false,
          documents: false,
          faqs: false,
        },
      },
    })
    if (guideSnapshot.kind !== "ready") throw new Error("Snapshot not ready")
    expect(guideSnapshot.guides.map((guide) => guide.id)).toContain(
      "draft-guide"
    )
    expect(guideSnapshot.events).toHaveLength(0)
    expect(guideSnapshot.announcements).toHaveLength(0)
    expect(guideSnapshot.documents).toHaveLength(0)
    expect(
      await worker.query(api.hubs.getManagerAccess, {
        organizationHint: "org-a",
      })
    ).toBe("viewer")

    await worker.mutation(api.content.saveGuide, {
      hubId,
      slug: "worker-guide",
      title: "Worker guide",
      description: "Created from the worker-facing Manage Guides entry point",
      categorySlug: "operations",
      duration: "4 min",
      featured: false,
      published: true,
      keywords: [],
      content: { type: "doc" },
    })
    await expect(
      worker.mutation(api.content.saveEvent, {
        hubId,
        slug: "blocked-worker-event",
        title: "Blocked worker event",
        description: "Events have not been enabled",
        category: "event-reservation",
        start: "2026-08-02T10:00",
        end: "2026-08-02T11:00",
        location: "Office",
        notes: "",
        published: true,
        guideSlugs: [],
        employeeProfileIds: [],
      })
    ).rejects.toThrow("editingAccessRequired")
    await expect(
      worker.mutation(api.files.generateUploadUrl, {
        hubId,
        section: "documents",
        sha256: "a".repeat(64),
        size: 1,
      })
    ).rejects.toThrow("editingAccessRequired")
    await expect(
      worker.mutation(api.content.saveFaq, {
        hubId,
        slug: "blocked-worker-question",
        question: "Can a worker add this yet?",
        answer: "Not until Common questions editing is enabled.",
      })
    ).rejects.toThrow("editingAccessRequired")
    await expect(
      worker.mutation(api.hubs.setWorkersCanEdit, {
        hubId,
        section: "events",
        enabled: true,
      })
    ).rejects.toThrow("fullContentAccessRequired")
    await expect(
      worker.query(api.employees.listAssignable, {
        hubId,
        workerSection: "events",
      })
    ).rejects.toThrow("editingAccessRequired")

    for (const section of [
      "events",
      "announcements",
      "documents",
      "faqs",
    ] as const) {
      await manager.mutation(api.hubs.setWorkersCanEdit, {
        hubId,
        section,
        enabled: true,
      })
    }
    const assignableProfiles = await worker.query(
      api.employees.listAssignable,
      {
        hubId,
        workerSection: "events",
      }
    )
    expect(assignableProfiles.map((profile) => profile.id)).toEqual(
      expect.arrayContaining([
        workerProfileId,
        otherWorkerProfileId,
        managerProfileId,
      ])
    )
    await expect(
      worker.mutation(api.files.generateUploadUrl, {
        hubId,
        section: "documents",
        sha256: "b".repeat(64),
        size: 1,
      })
    ).resolves.toMatchObject({ uploadUrl: expect.any(String) })
    await worker.mutation(api.content.saveEvent, {
      hubId,
      slug: "worker-event",
      title: "Worker event",
      description: "Created by a worker",
      category: "event-reservation",
      start: "2026-08-03T10:00",
      end: "2026-08-03T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [otherWorkerProfileId],
    })
    await worker.mutation(api.content.saveAnnouncement, {
      hubId,
      slug: "worker-announcement",
      title: "Worker announcement",
      content: { type: "doc" },
      publishedAt: "2026-07-30",
      expiresAt: "2026-08-30",
      priority: "Normal",
      pinned: false,
      published: true,
    })
    await worker.mutation(api.documents.save, {
      hubId,
      slug: "worker-document",
      title: "Worker document",
      description: "Created by a worker",
      resource: { kind: "link", url: "https://example.test/worker" },
      employeeProfileIds: [],
      published: true,
    })
    await worker.mutation(api.content.saveFaq, {
      hubId,
      slug: "worker-question",
      question: "Can a worker add this answer?",
      answer: "Yes, when Common questions editing is enabled.",
    })
    await expect(
      worker.mutation(api.content.saveEvent, {
        hubId,
        slug: "invalid-reference-event",
        title: "Invalid reference event",
        description: "Must reject an unknown guide instead of dropping it",
        category: "event-reservation",
        start: "2026-08-04T10:00",
        end: "2026-08-04T11:00",
        location: "Office",
        notes: "",
        published: false,
        guideSlugs: ["missing-guide"],
        employeeProfileIds: [],
      })
    ).rejects.toThrow("guideNotFound")
    await expect(
      worker.mutation(api.content.saveAnnouncement, {
        hubId,
        slug: "invalid-reference-announcement",
        title: "Invalid reference announcement",
        content: { type: "doc" },
        publishedAt: "2026-07-30",
        expiresAt: "2026-08-30",
        priority: "Normal",
        pinned: false,
        published: false,
        eventSlug: "missing-event",
      })
    ).rejects.toThrow("eventNotFound")
    await expect(
      worker.mutation(api.content.deleteGuide, {
        hubId,
        slug: "worker-guide",
      })
    ).rejects.toThrow("fullContentAccessRequired")
    await expect(
      worker.mutation(api.content.deleteFaq, {
        hubId,
        slug: "worker-question",
      })
    ).rejects.toThrow("fullContentAccessRequired")

    await manager.mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "guides",
      enabled: false,
    })
    await expect(
      worker.mutation(api.content.saveEvent, {
        hubId,
        slug: "draft-event",
        title: "Blocked draft relationship update",
        description: "Must not add a new relationship to a hidden draft guide",
        category: "event-reservation",
        start: "2026-08-01T10:00",
        end: "2026-08-01T11:00",
        location: "Office",
        notes: "",
        published: false,
        guideSlugs: ["unlinked-draft-guide"],
        employeeProfileIds: [],
      })
    ).rejects.toThrow("relatedGuidesMustBePublished")
    const hiddenRelationshipSnapshot = await worker.query(
      api.hubs.getManagerSnapshot,
      { nowDate: "2026-07-30" }
    )
    if (hiddenRelationshipSnapshot.kind !== "ready") {
      throw new Error("Snapshot not ready")
    }
    expect(
      hiddenRelationshipSnapshot.guides.map((guide) => guide.id)
    ).not.toContain("draft-guide")
    expect(
      (hiddenRelationshipSnapshot.guideReferences ?? []).map(
        (guide) => guide.id
      )
    ).toEqual(expect.arrayContaining(["published-guide", "worker-guide"]))
    expect(
      (hiddenRelationshipSnapshot.guideReferences ?? []).some(
        (guide) => !guide.published
      )
    ).toBe(false)
    expect(
      hiddenRelationshipSnapshot.events.find(
        (event) => event.id === "draft-event"
      )?.guideIds
    ).toEqual(["published-guide"])
    expect(
      hiddenRelationshipSnapshot.announcements.find(
        (announcement) => announcement.id === "draft-announcement"
      )
    ).toMatchObject({
      guideId: "published-guide",
      eventId: "draft-event",
    })
    expect(
      hiddenRelationshipSnapshot.documents.find(
        (document) => document.id === "draft-document"
      )?.relatedGuideIds
    ).toEqual(["published-guide"])
    expect(
      hiddenRelationshipSnapshot.events.find(
        (event) => event.id === "worker-event"
      )?.employees
    ).toContainEqual({
      id: otherWorkerProfileId,
      displayName: "Other Worker",
    })

    await expect(
      worker.mutation(api.documents.save, {
        hubId,
        slug: "draft-document",
        title: "Blocked draft relationship update",
        description: "Must not add a new relationship to a hidden draft guide",
        employeeProfileIds: [],
        relatedGuideSlugs: ["unlinked-draft-guide"],
        published: false,
      })
    ).rejects.toThrow("relatedGuidesMustBePublished")
    await worker.mutation(api.documents.save, {
      hubId,
      slug: "draft-document",
      title: "Draft document updated by worker",
      description: "Keeps its published guide relationship",
      employeeProfileIds: [],
      relatedGuideSlugs: ["published-guide"],
      published: false,
    })

    await worker.mutation(api.content.saveEvent, {
      hubId,
      slug: "draft-event",
      title: "Draft event updated by worker",
      description: "Must keep its restricted guide relationship",
      category: "event-reservation",
      start: "2026-08-01T10:00",
      end: "2026-08-01T11:00",
      location: "Office",
      notes: "",
      published: false,
      guideSlugs: ["published-guide"],
      employeeProfileIds: [workerProfileId],
    })
    await manager.mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "events",
      enabled: false,
    })
    await expect(
      worker.mutation(api.content.saveAnnouncement, {
        hubId,
        slug: "draft-announcement",
        title: "Blocked draft event relationship update",
        content: { type: "doc" },
        publishedAt: "2026-07-30",
        expiresAt: "2026-08-30",
        priority: "Normal",
        pinned: false,
        published: false,
        guideSlug: "published-guide",
        eventSlug: "unlinked-draft-event",
      })
    ).rejects.toThrow("editingAccessRequired")
    await worker.mutation(api.content.saveAnnouncement, {
      hubId,
      slug: "draft-announcement",
      title: "Draft announcement updated by worker",
      content: { type: "doc" },
      publishedAt: "2026-07-30",
      expiresAt: "2026-08-30",
      priority: "Normal",
      pinned: false,
      published: false,
      guideSlug: "published-guide",
      eventSlug: "draft-event",
    })
    const announcementSnapshot = await worker.query(
      api.hubs.getManagerSnapshot,
      { nowDate: "2026-07-30" }
    )
    if (announcementSnapshot.kind !== "ready") {
      throw new Error("Snapshot not ready")
    }
    expect(announcementSnapshot.events.map((event) => event.id)).not.toContain(
      "draft-event"
    )
    expect(announcementSnapshot.eventReferences ?? []).toContainEqual({
      id: "draft-event",
      title: "Draft event updated by worker",
      published: false,
    })
    expect(
      (announcementSnapshot.eventReferences ?? []).map((event) => event.id)
    ).not.toContain("unlinked-draft-event")
    const managerSnapshot = await manager.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-07-30",
    })
    if (managerSnapshot.kind !== "ready") throw new Error("Snapshot not ready")
    expect(
      managerSnapshot.events.find((event) => event.id === "draft-event")
        ?.guideIds
    ).toEqual(["published-guide"])
    expect(
      managerSnapshot.announcements.find(
        (announcement) => announcement.id === "draft-announcement"
      )
    ).toMatchObject({
      guideId: "published-guide",
      eventId: "draft-event",
    })
    await expect(
      worker.mutation(api.content.saveGuide, {
        hubId,
        slug: "worker-guide",
        title: "Blocked guide update",
        description: "Guide access was disabled",
        categorySlug: "operations",
        duration: "4 min",
        featured: false,
        published: true,
        keywords: [],
        content: { type: "doc" },
      })
    ).rejects.toThrow("editingAccessRequired")
  })

  test("permanently removes only the employee's workplace data", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(
      t,
      hubId,
      "Former Employee",
      "former@example.test"
    )
    const owner = t.withIdentity(orgAdminIdentity)

    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", profileId, {
        clerkUserId: orgMemberIdentity.subject,
        status: "active",
      })
    })
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "former-employee-event",
      title: "Former employee event",
      description: "Used to verify permanent employee cleanup",
      category: "event-reservation",
      start: "2026-07-20T10:00",
      end: "2026-07-20T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
    })
    await t
      .withIdentity(orgMemberIdentity)
      .mutation(api.notifications.markEmployeeRead, {
        hubSlug: "org-hub",
      })

    await expect(
      t
        .withIdentity(orgMemberIdentity)
        .mutation(api.employees.removeProfileBatch, { profileId })
    ).rejects.toThrow("workplaceOwnerAccessRequired")

    expect(
      await owner.mutation(api.employees.removeProfileBatch, { profileId })
    ).toEqual({ removed: false })
    expect(
      await owner.mutation(api.employees.removeProfileBatch, { profileId })
    ).toEqual({ removed: true })

    const relatedRecords = await t.run(async (ctx) => {
      const event = await ctx.db
        .query("events")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "former-employee-event")
        )
        .unique()
      return {
        profile: await ctx.db.get("employeeProfiles", profileId),
        assignments: await ctx.db
          .query("eventEmployees")
          .withIndex("by_employeeProfileId_and_eventId", (q) =>
            q.eq("employeeProfileId", profileId)
          )
          .take(10),
        notifications: await ctx.db
          .query("notifications")
          .withIndex("by_employeeProfileId", (q) =>
            q.eq("employeeProfileId", profileId)
          )
          .take(10),
        notificationReadStates: await ctx.db
          .query("notificationReadStates")
          .withIndex("by_employeeProfileId", (q) =>
            q.eq("employeeProfileId", profileId)
          )
          .take(10),
        event,
      }
    })
    expect(relatedRecords.profile).toBeNull()
    expect(relatedRecords.assignments).toEqual([])
    expect(relatedRecords.notifications).toEqual([])
    expect(relatedRecords.notificationReadStates).toEqual([])
    expect(relatedRecords.event).not.toBeNull()

    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      nowDate: "2026-07-19",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(snapshot.events[0]?.employees).toEqual([])

    await owner.mutation(api.hubs.setAccessMode, {
      hubId,
      accessMode: "restricted",
    })
    expect(
      (
        await t
          .withIdentity(orgMemberIdentity)
          .query(api.hubs.getPublicSnapshot, {
            slug: "org-hub",
            nowDate: "2026-07-19",
          })
      ).kind
    ).toBe("restricted")
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
      "notAuthenticated"
    )
    await t.withIdentity(orgAdminIdentity).mutation(api.content.saveEvent, {
      hubId,
      slug: "linked-event",
      title: "Linked event",
      description: "Shows a safe employee projection",
      category: "event-reservation",
      start: "2026-07-20T10:00",
      end: "2026-07-20T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
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

  test("returns private events only to active members of the current workplace", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(t, hubId, "Active Member")
    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", profileId, {
        clerkUserId: orgMemberIdentity.subject,
        status: "active",
      })
    })
    const admin = t.withIdentity(orgAdminIdentity)
    const baseEvent = {
      hubId,
      description: "Privacy boundary test",
      category: "event-reservation",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
    }
    await admin.mutation(api.content.saveEvent, {
      ...baseEvent,
      slug: "public-event",
      title: "Public briefing",
      start: "2026-07-21T10:00",
      end: "2026-07-21T11:00",
      isPrivate: false,
    })
    await admin.mutation(api.content.saveEvent, {
      ...baseEvent,
      slug: "private-event",
      title: "Private employee shift",
      start: "2026-07-21T11:00",
      end: "2026-07-21T12:00",
      isPrivate: true,
    })
    await admin.mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "events",
      enabled: true,
    })
    await expect(
      t.withIdentity(orgMemberIdentity).mutation(api.content.saveEvent, {
        ...baseEvent,
        slug: "private-event",
        title: "Private employee shift",
        start: "2026-07-21T11:00",
        end: "2026-07-21T12:00",
        isPrivate: false,
      })
    ).rejects.toThrow("eventPrivacyManagerAccessRequired")
    const managerProfileId = await createEmployee(t, hubId, "Privacy Manager")
    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", managerProfileId, {
        clerkUserId: appManagerIdentity.subject,
        status: "active",
        accessLevel: "manager",
      })
    })
    const manager = t.withIdentity(appManagerIdentity)
    await manager.mutation(api.content.saveEvent, {
      ...baseEvent,
      slug: "private-event",
      title: "Private employee shift",
      start: "2026-07-21T11:00",
      end: "2026-07-21T12:00",
      isPrivate: false,
    })
    await manager.mutation(api.content.saveEvent, {
      ...baseEvent,
      slug: "private-event",
      title: "Private employee shift",
      start: "2026-07-21T11:00",
      end: "2026-07-21T12:00",
      isPrivate: true,
    })

    const guest = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      nowDate: "2026-07-19",
    })
    if (guest.kind !== "ready") throw new Error("Expected public snapshot")
    expect(guest.events.map((event) => event.id)).toEqual(["public-event"])
    expect(JSON.stringify(guest)).not.toContain("Private employee shift")

    const credentialGuest = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      credential: "ORGA-NIZE",
      nowDate: "2026-07-19",
    })
    if (credentialGuest.kind !== "ready") {
      throw new Error("Expected credential snapshot")
    }
    expect(credentialGuest.events.map((event) => event.id)).toEqual([
      "public-event",
    ])

    const wrongWorkplace = await t
      .withIdentity(otherOrgAdminIdentity)
      .query(api.hubs.getPublicSnapshot, {
        slug: "org-hub",
        nowDate: "2026-07-19",
      })
    if (wrongWorkplace.kind !== "ready") {
      throw new Error("Expected public snapshot for other account")
    }
    expect(wrongWorkplace.events.map((event) => event.id)).toEqual([
      "public-event",
    ])

    const member = await t
      .withIdentity(orgMemberIdentity)
      .query(api.hubs.getActiveMemberSnapshot, {
        nowDate: "2026-07-19",
        organizationHint: "org-a",
      })
    if (member.kind !== "ready") throw new Error("Expected member snapshot")
    expect(member.events.map((event) => event.id)).toEqual([
      "public-event",
      "private-event",
    ])
    expect(member.events[1]).toMatchObject({ isPrivate: true })
    const memberUsingPublicRoute = await t
      .withIdentity(orgMemberIdentity)
      .query(api.hubs.getPublicSnapshot, {
        slug: "org-hub",
        nowDate: "2026-07-19",
      })
    if (memberUsingPublicRoute.kind !== "ready") {
      throw new Error("Expected member snapshot through public route")
    }
    expect(memberUsingPublicRoute.events.map((event) => event.id)).toEqual([
      "public-event",
      "private-event",
    ])

    const guestSearch = await t.query(api.search.published, {
      hubSlug: "org-hub",
      query: "Private employee shift",
      nowDate: "2026-07-19",
    })
    expect(guestSearch).toEqual([])
    const memberSearch = await t
      .withIdentity(orgMemberIdentity)
      .query(api.search.published, {
        hubSlug: "org-hub",
        query: "Private employee shift",
        nowDate: "2026-07-19",
      })
    expect(memberSearch.map((result) => result.id)).toEqual(["private-event"])
  })

  test("does not let private events consume the public snapshot limit", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const category = await t.run(async (ctx) =>
      ctx.db
        .query("categories")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "event-reservation")
        )
        .unique()
    )
    if (!category) throw new Error("Expected event category")
    await t.run(async (ctx) => {
      for (let index = 0; index < 501; index += 1) {
        await ctx.db.insert("events", {
          hubId,
          slug: `private-${index}`,
          title: `Private ${index}`,
          description: "Private event",
          categoryId: category._id,
          start: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T10:00`,
          end: `2026-07-${String((index % 28) + 1).padStart(2, "0")}T11:00`,
          location: "Office",
          notes: "",
          published: true,
          isPrivate: true,
        })
      }
      await ctx.db.insert("events", {
        hubId,
        slug: "public-after-private-limit",
        title: "Public after private limit",
        description: "Must remain visible",
        categoryId: category._id,
        start: "2026-08-01T10:00",
        end: "2026-08-01T11:00",
        location: "Office",
        notes: "",
        published: true,
        isPrivate: false,
      })
    })

    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      nowDate: "2026-07-19",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(snapshot.events.map((event) => event.id)).toEqual([
      "public-after-private-limit",
    ])
  })

  test("persists all-day state and validates exact timed instants", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const admin = t.withIdentity(orgAdminIdentity)
    const baseEvent = {
      hubId,
      title: "Calendar interoperability",
      description: "Calendar date semantics",
      category: "event-reservation" as const,
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
    }

    await admin.mutation(api.content.saveEvent, {
      ...baseEvent,
      slug: "all-day-event",
      start: "2026-07-24T00:00",
      end: "2026-07-25T00:00",
      allDay: true,
      startUtc: null,
      endUtc: null,
    })
    await admin.mutation(api.content.saveEvent, {
      ...baseEvent,
      slug: "fallback-event",
      start: "2026-10-25T03:30",
      end: "2026-10-25T03:15",
      allDay: false,
      startUtc: "2026-10-25T00:30:00.000Z",
      endUtc: "2026-10-25T01:15:00.000Z",
      icalUid: "outlook-event@example.test",
    })

    const snapshot = await t.query(api.hubs.getPublicSnapshot, {
      slug: "org-hub",
      nowDate: "2026-07-19",
    })
    if (snapshot.kind !== "ready") throw new Error("Expected public snapshot")
    expect(
      snapshot.events.find((event) => event.id === "all-day-event")
    ).toMatchObject({
      allDay: true,
      start: "2026-07-24T00:00",
      end: "2026-07-25T00:00",
    })
    expect(
      snapshot.events.find((event) => event.id === "fallback-event")
    ).toMatchObject({
      allDay: false,
      startUtc: "2026-10-25T00:30:00.000Z",
      endUtc: "2026-10-25T01:15:00.000Z",
      icalUid: "outlook-event@example.test",
    })

    await expect(
      admin.mutation(api.content.saveEvent, {
        ...baseEvent,
        slug: "invalid-instant-event",
        start: "2026-07-24T10:00",
        end: "2026-07-24T11:00",
        startUtc: "2026-07-24T07:00:00.000Z",
        endUtc: null,
      })
    ).rejects.toThrow("eventStartEndInstantsProvidedTogether")
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
      category: "event-reservation" as const,
      start: "2026-07-21T10:00",
      end: "2026-07-21T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
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
    ).rejects.toThrow("employeeNotBelongWorkplace")
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
      .mutation(api.employees.activateByInvitation, {
        correlationCredential: existingCredential,
      })
    await t
      .withIdentity(orgMemberIdentity)
      .mutation(api.employees.activateByInvitation, {
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
    await t
      .withIdentity(newMember)
      .mutation(api.employees.activateByInvitation, {
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
      category: "event-reservation" as const,
      start: "2026-07-22T10:00",
      end: "2026-07-22T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
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
      "deactivatedEmployeesCannotAddedEvents"
    )
  })

  test("blocks a deactivated linked member even while a stale token names the Organization", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(
      t,
      hubId,
      "Departed Employee",
      "departed@example.test"
    )
    const admin = t.withIdentity(orgAdminIdentity)
    const correlationCredential =
      "departed-employee-invitation-correlation-credential"
    await admin.mutation(api.employees.prepareInvitation, {
      profileId,
      correlationCredential,
    })
    await t
      .withIdentity(orgMemberIdentity)
      .mutation(api.employees.activateByInvitation, { correlationCredential })
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
    expect(
      (
        await t
          .withIdentity({
            ...orgMemberIdentity,
            o: { id: "org-a", rol: "admin", slg: "workplace-a" },
          })
          .query(api.hubs.getActiveMemberSnapshot, {
            nowDate: "2026-07-19",
            organizationHint: "org-a",
          })
      ).kind
    ).toBe("deactivated")
  })

  test("searches events through employee relations", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createOrganizationHub(t)
    const profileId = await createEmployee(t, hubId, "Searchable Employee")
    await t.withIdentity(orgAdminIdentity).mutation(api.content.saveEvent, {
      hubId,
      slug: "search-event",
      title: "Team briefing",
      description: "Normal event",
      category: "event-reservation",
      start: "2026-07-24T10:00",
      end: "2026-07-24T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
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
      category: "event-reservation",
      start: "2026-07-24T10:00",
      end: "2026-07-24T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
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
      kind: "guide",
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
    expect(firstFeed.notifications[0]?.titleKey).toBe(
      "notificationNewGuidePublished"
    )

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
    ).rejects.toThrow("hubAccessRequired")
  })

  test("treats attachments selected in the event editor as part of one notification", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "event-with-file",
      title: "Event with file",
      description: "Published together with an attachment",
      category: "event-reservation",
      start: "2026-08-01T10:00",
      end: "2026-08-01T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
    })
    const storageId = await createRegisteredUpload(t, {
      hubId,
      identity: ownerIdentity,
      blob: new Blob(["agenda"], { type: "text/plain" }),
    })
    await owner.mutation(api.files.attachToEvent, {
      hubId,
      eventSlug: "event-with-file",
      storageId,
      name: "agenda.txt",
      contentType: "text/plain",
      notifyEmployees: false,
    })

    const feed = await t.query(api.notifications.listEmployee, {
      hubSlug: "test-hub",
      guestDeviceId: "guest-device-event-with-file",
    })
    expect(feed.notifications.map((item) => item.titleKey)).toEqual([
      "notificationNewEventAdded",
    ])
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
      category: "event-reservation",
      start: "2026-07-25T10:00",
      end: "2026-07-25T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: [profileId],
    })

    const memberFeed = await t
      .withIdentity(orgMemberIdentity)
      .query(api.notifications.listEmployee, {
        hubSlug: "org-hub",
        guestDeviceId: "unused-for-an-authenticated-member",
      })
    expect(memberFeed.notifications.map((item) => item.titleKey)).toEqual(
      expect.arrayContaining([
        "notificationNewEventAdded",
        "notificationAssignedToEvent",
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
      category: "event-reservation",
      start: "2026-07-26T10:00",
      end: "2026-07-26T11:00",
      location: "Office",
      notes: "",
      published: true,
      guideSlugs: [],
      employeeProfileIds: profileIds,
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
