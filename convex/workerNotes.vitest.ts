/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const memberIdentity = {
  subject: "employee-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|employee-a",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}
const ownerIdentity = {
  subject: "owner-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-a",
  o: { id: "org-a", rol: "admin", slg: "workplace-a" },
}
const outsiderIdentity = {
  subject: "owner-b",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-b",
  o: { id: "org-b", rol: "admin", slg: "workplace-b" },
}

async function createHubWithActiveMember(
  t: ReturnType<typeof convexTest>
): Promise<Id<"hubs">> {
  return await t.run(async (ctx) => {
    const now = Date.now()
    const hubId = await ctx.db.insert("hubs", {
      name: "Test workplace",
      slug: "test-workplace",
      clerkOrganizationId: "org-a",
      accessMode: "public",
      joinCodeHash: "join-code",
      privateTokenHash: "private-token",
      credentialVersion: 1,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("employeeProfiles", {
      hubId,
      clerkUserId: memberIdentity.subject,
      displayName: "Employee A",
      status: "active",
      accessLevel: "viewer",
      createdBy: ownerIdentity.subject,
      createdAt: now,
      updatedAt: now,
      activatedAt: now,
      invitationStatus: "accepted",
    })
    return hubId
  })
}

describe("worker notes", () => {
  test("shares one editable text value with active workplace members", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)

    await t.withIdentity(memberIdentity).mutation(api.workerNotes.save, {
      hubId,
      text: "Restock the front desk\nCall the electrician",
    })

    await expect(
      t.withIdentity(ownerIdentity).query(api.workerNotes.get, {
        hubId,
        now: Date.now(),
      })
    ).resolves.toBe("Restock the front desk\nCall the electrician")

    const storedNotes = await t.run(async (ctx) => {
      return await ctx.db
        .query("workerNotes")
        .withIndex("by_hubId_and_pinned_and_expiresAt", (q) =>
          q.eq("hubId", hubId)
        )
        .take(2)
    })
    expect(storedNotes).toMatchObject([
      {
        text: "Restock the front desk\nCall the electrician",
        pinned: true,
      },
    ])
  })

  test("keeps notes scoped to their workplace", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const outsider = t.withIdentity(outsiderIdentity)

    await expect(
      outsider.query(api.workerNotes.get, { hubId, now: Date.now() })
    ).rejects.toThrow("unauthorized")
    await expect(
      outsider.mutation(api.workerNotes.save, { hubId, text: "Not allowed" })
    ).rejects.toThrow("unauthorized")
  })

  test("shows legacy rows as lines and consolidates them on save", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const now = Date.now()
    await t.run(async (ctx) => {
      await ctx.db.insert("workerNotes", {
        hubId,
        text: "Pinned first",
        pinned: true,
        expiresAt: now - 1,
      })
      await ctx.db.insert("workerNotes", {
        hubId,
        text: "Active second",
        pinned: false,
        expiresAt: now + 60_000,
      })
      await ctx.db.insert("workerNotes", {
        hubId,
        text: "Expired",
        pinned: false,
        expiresAt: now - 1,
      })
    })
    const member = t.withIdentity(memberIdentity)

    await expect(
      member.query(api.workerNotes.get, { hubId, now })
    ).resolves.toBe("Pinned first\nActive second")

    await member.mutation(api.workerNotes.save, {
      hubId,
      text: "Pinned first\nActive second\nNew line",
    })
    const storedNotes = await t.run(async (ctx) => {
      return await ctx.db
        .query("workerNotes")
        .withIndex("by_hubId_and_pinned_and_expiresAt", (q) =>
          q.eq("hubId", hubId)
        )
        .take(4)
    })
    expect(storedNotes).toHaveLength(1)
    expect(storedNotes[0]?.text).toBe("Pinned first\nActive second\nNew line")
  })

  test("clears blank notes and rejects oversized text", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)

    await member.mutation(api.workerNotes.save, { hubId, text: "Temporary" })
    await member.mutation(api.workerNotes.save, { hubId, text: "   " })
    await expect(
      member.query(api.workerNotes.get, { hubId, now: Date.now() })
    ).resolves.toBe("")
    await expect(
      member.mutation(api.workerNotes.save, {
        hubId,
        text: "x".repeat(10_001),
      })
    ).rejects.toThrow("workerNoteTooLong")
  })
})
