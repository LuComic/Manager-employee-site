/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api } from "./_generated/api"
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
      nowDate: "2026-07-18",
    })
    expect(snapshot.kind).toBe("ready")
    if (snapshot.kind === "ready") {
      expect(snapshot.faqs).toHaveLength(1)
    }

    await t.mutation(api.content.submitHelpRequest, {
      hubSlug: "test-hub",
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
