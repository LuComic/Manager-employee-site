/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const webhookSecret = "whsec_c2VjdXJpdHktdGVzdC1vbmx5LXNlY3JldA=="
const ownerA = {
  subject: "security-owner-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|security-owner-a",
  o: { id: "security-org-a", rol: "admin", slg: "security-a" },
}
const ownerB = {
  subject: "security-owner-b",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|security-owner-b",
  o: { id: "security-org-b", rol: "admin", slg: "security-b" },
}

async function createHub(
  t: ReturnType<typeof convexTest>,
  identity: typeof ownerA,
  slug: string,
  restricted = false
) {
  return await t.withIdentity(identity).mutation(api.hubs.create, {
    name: `Security ${slug}`,
    slug,
    accessMode: restricted ? "restricted" : "public",
    joinCode: "SAFE-CODE",
    privateToken: "synthetic-private-token-that-is-long-enough",
    timeZone: "Europe/Tallinn",
  })
}

function expectExactKeys(value: object, expected: readonly string[]) {
  expect(Object.keys(value).sort()).toEqual([...expected].sort())
}

function decodeWebhookSecret(secret: string) {
  return Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (character) =>
    character.charCodeAt(0)
  )
}

async function webhookHeaders(eventId: string, payload: string) {
  const timestamp = Math.floor(Date.now() / 1_000).toString()
  const key = await crypto.subtle.importKey(
    "raw",
    decodeWebhookSecret(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${eventId}.${timestamp}.${payload}`)
    )
  )
  return {
    "content-type": "application/json",
    "svix-id": eventId,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${btoa(String.fromCharCode(...signature))}`,
  }
}

describe("security policy regression coverage", () => {
  test("guest snapshots use explicit allowlisted projections", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t, ownerA, "guest-allowlist", true)
    const owner = t.withIdentity(ownerA)
    const employeeId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Synthetic Employee",
      email: "private-employee@example.test",
      department: "Private Operations",
      jobTitle: "Private Role",
      accessLevel: "viewer",
    })
    await owner.mutation(api.employees.prepareInvitation, {
      profileId: employeeId,
      correlationCredential: "synthetic-invitation-correlation-secret",
    })
    await owner.mutation(api.employees.recordInvitation, {
      profileId: employeeId,
      invitationId: "inv_synthetic_private",
    })
    await owner.mutation(api.content.saveCategory, {
      hubId,
      slug: "assurance-guides",
      label: "Assurance guides",
      iconKey: "general",
      description: "Published guidance",
      kind: "guide",
    })
    await owner.mutation(api.content.saveGuide, {
      hubId,
      slug: "published-guide",
      title: "Published guide",
      description: "Guest-safe guide",
      categorySlug: "assurance-guides",
      duration: "5 min",
      featured: true,
      published: true,
      keywords: ["safe"],
      relatedGuideSlugs: [],
      content: { type: "doc", content: [] },
    })
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "published-event",
      title: "Published event",
      description: "Guest-safe event",
      category: "event-reservation",
      start: "2026-08-20T10:00",
      end: "2026-08-20T11:00",
      location: "Public room",
      employeeProfileIds: [employeeId],
      notes: "Public notes",
      published: true,
      guideSlugs: ["published-guide"],
    })
    await owner.mutation(api.content.saveAnnouncement, {
      hubId,
      slug: "published-announcement",
      title: "Published announcement",
      content: { type: "doc", content: [] },
      publishedAt: "2026-08-01",
      expiresAt: "2026-09-01",
      priority: "Important",
      pinned: true,
      published: true,
      guideSlug: "published-guide",
      eventSlug: "published-event",
    })
    await owner.mutation(api.content.saveFaq, {
      hubId,
      slug: "published-faq",
      question: "Is this safe?",
      answer: "Yes.",
    })
    await owner.mutation(api.documents.save, {
      hubId,
      slug: "published-document",
      title: "Published document",
      description: "Guest-safe document",
      resource: { kind: "link", url: "https://example.test/public" },
      bannerStorageId: null,
      employeeProfileIds: [employeeId],
      relatedGuideSlugs: ["published-guide"],
      published: true,
    })

    const result = await t.query(api.hubs.getPublicSnapshot, {
      slug: "guest-allowlist",
      credential: "SAFE-CODE",
      nowDate: "2026-08-20",
    })
    expect(result.kind).toBe("ready")
    if (result.kind !== "ready") throw new Error("Expected guest snapshot")
    const snapshot = JSON.parse(JSON.stringify(result)) as typeof result

    expectExactKeys(snapshot, [
      "kind",
      "hub",
      "categories",
      "guides",
      "events",
      "announcements",
      "faqs",
      "documents",
    ])
    expectExactKeys(snapshot.hub, [
      "id",
      "name",
      "slug",
      "accessMode",
      "credentialVersion",
      "description",
      "address",
      "timeZone",
      "contactName",
      "contactEmail",
      "contactPhone",
      "todaySections",
      "workersCanEdit",
    ])
    expectExactKeys(snapshot.guides[0], [
      "id",
      "title",
      "description",
      "category",
      "duration",
      "updated",
      "featured",
      "published",
      "keywords",
      "relatedGuideIds",
      "content",
    ])
    expectExactKeys(snapshot.events[0], [
      "id",
      "title",
      "description",
      "category",
      "start",
      "end",
      "allDay",
      "location",
      "employees",
      "notes",
      "published",
      "guideIds",
      "attachments",
    ])
    expectExactKeys(snapshot.events[0].employees[0], ["displayName"])
    expectExactKeys(snapshot.announcements[0], [
      "id",
      "title",
      "content",
      "publishedAt",
      "expiresAt",
      "priority",
      "pinned",
      "published",
      "guideId",
      "eventId",
    ])
    expectExactKeys(snapshot.faqs[0], ["id", "question", "answer", "order"])
    expectExactKeys(snapshot.documents[0], [
      "id",
      "title",
      "description",
      "resource",
      "employees",
      "relatedGuideIds",
      "published",
      "updatedAt",
    ])
    expectExactKeys(snapshot.documents[0].resource, ["kind", "url"])
    expectExactKeys(snapshot.documents[0].employees[0], ["displayName"])

    const serialized = JSON.stringify(snapshot)
    for (const privateValue of [
      "private-employee@example.test",
      "Private Operations",
      "Private Role",
      "inv_synthetic_private",
      "synthetic-invitation-correlation-secret",
      "synthetic-private-token-that-is-long-enough",
      ownerA.tokenIdentifier,
    ]) {
      expect(serialized).not.toContain(privateValue)
    }
  })

  test("foreign hub and employee identifiers cannot enumerate or mutate tenant data", async () => {
    const t = convexTest(schema, modules)
    const first = await createHub(t, ownerA, "tenant-a", true)
    await createHub(t, ownerB, "tenant-b")
    const firstOwner = t.withIdentity(ownerA)
    const outsider = t.withIdentity(ownerB)
    const employeeId = await firstOwner.mutation(api.employees.create, {
      hubId: first.hubId,
      displayName: "Tenant A Employee",
      email: "tenant-a-private@example.test",
      accessLevel: "viewer",
    })
    const before = await t.run(async (ctx) => ({
      hub: await ctx.db.get("hubs", first.hubId),
      employee: await ctx.db.get("employeeProfiles", employeeId),
    }))

    await expect(
      outsider.query(api.employees.getForAdmin, { profileId: employeeId })
    ).rejects.toThrow("unauthorized")
    await expect(
      outsider.query(api.employees.list, { hubId: first.hubId })
    ).rejects.toThrow("unauthorized")
    await expect(
      outsider.query(api.auditLogs.list, {
        hubId: first.hubId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).rejects.toThrow("unauthorized")
    await expect(
      outsider.query(api.hubs.getOwnerCredentials, { hubId: first.hubId })
    ).rejects.toThrow("unauthorized")
    await expect(
      outsider.mutation(api.employees.update, {
        profileId: employeeId,
        displayName: "Cross-tenant overwrite",
        email: "attacker@example.test",
        accessLevel: "manager",
      })
    ).rejects.toThrow("unauthorized")
    await expect(
      outsider.mutation(api.hubs.rotateCredentials, {
        hubId: first.hubId,
        joinCode: "EVIL-CODE",
        privateToken: "attacker-private-token-that-is-long-enough",
      })
    ).rejects.toThrow("unauthorized")
    await expect(
      outsider.mutation(api.files.generateUploadUrl, {
        hubId: first.hubId,
        sha256: "0".repeat(64),
        size: 1,
      })
    ).rejects.toThrow("unauthorized")

    const after = await t.run(async (ctx) => ({
      hub: await ctx.db.get("hubs", first.hubId),
      employee: await ctx.db.get("employeeProfiles", employeeId),
      uploadIntents: await ctx.db.query("uploadIntents").take(10),
    }))
    expect(after.hub).toEqual(before.hub)
    expect(after.employee).toEqual(before.employee)
    expect(after.uploadIntents).toEqual([])
  })

  test("invalid Clerk signatures make no change and valid replays stay idempotent", async () => {
    const t = convexTest(schema, modules)
    const eventId = "evt_security_webhook_once"
    const payload = JSON.stringify({
      type: "organizationInvitation.revoked",
      data: {
        id: "inv_missing_synthetic",
        organization_id: "security-org-a",
        public_metadata: {},
      },
    })
    const validHeaders = await webhookHeaders(eventId, payload)
    const invalidResponse = await t.fetch("/clerk-webhooks", {
      method: "POST",
      headers: { ...validHeaders, "svix-signature": "v1,invalid" },
      body: payload,
    })
    expect(invalidResponse.status).toBe(400)
    expect(
      await t.run((ctx) => ctx.db.query("clerkWebhookEvents").take(10))
    ).toEqual([])

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await t.fetch("/clerk-webhooks", {
        method: "POST",
        headers: validHeaders,
        body: payload,
      })
      expect(response.status).toBe(200)
    }
    const events = await t.run((ctx) =>
      ctx.db.query("clerkWebhookEvents").take(10)
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      eventId,
      eventType: "organizationInvitation.revoked",
    })
  })
})
