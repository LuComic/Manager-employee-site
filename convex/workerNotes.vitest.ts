/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const DAY_MS = 24 * 60 * 60 * 1000
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

afterEach(() => {
  vi.useRealTimers()
})

describe("worker notes", () => {
  test("clears temporary lines after 24 hours and keeps ! lines", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"))
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const text = [
      "i am some temporary text",
      "! i will stay here",
      "some temp",
      "more more temp",
    ].join("\n")

    await member.mutation(api.workerNotes.save, { hubId, text })
    await expect(
      member.query(api.workerNotes.get, { hubId, now: Date.now() })
    ).resolves.toBe(text)

    vi.advanceTimersByTime(DAY_MS + 1)
    await expect(
      member.query(api.workerNotes.get, { hubId, now: Date.now() })
    ).resolves.toBe("! i will stay here")
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const storedNotes = await t.run(async (ctx) => {
      return await ctx.db
        .query("workerNotes")
        .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
        .unique()
    })
    expect(storedNotes).toMatchObject({ text: "! i will stay here" })
    expect(storedNotes).not.toHaveProperty("temporaryExpiresAt")
  })

  test("does not expire text when every non-empty line starts with !", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)

    await member.mutation(api.workerNotes.save, {
      hubId,
      text: "! Permanent one\n\n! Permanent two",
    })

    const storedNotes = await t.run(async (ctx) => {
      return await ctx.db
        .query("workerNotes")
        .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
        .unique()
    })
    expect(storedNotes).not.toHaveProperty("temporaryExpiresAt")
  })

  test("ignores an old cleanup after a later edit resets the clock", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"))
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)

    await member.mutation(api.workerNotes.save, {
      hubId,
      text: "Temporary",
    })
    const firstVersion = await t.run(async (ctx) => {
      return await ctx.db
        .query("workerNotes")
        .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
        .unique()
    })
    expect(firstVersion?.temporaryExpiresAt).toBeDefined()

    vi.advanceTimersByTime(DAY_MS - 1_000)
    await member.mutation(api.workerNotes.save, {
      hubId,
      text: "Temporary, edited",
    })
    await t.mutation(internal.workerNotes.clearTemporaryLines, {
      noteId: firstVersion!._id,
      temporaryExpiresAt: firstVersion!.temporaryExpiresAt!,
    })

    await expect(
      member.query(api.workerNotes.get, { hubId, now: Date.now() })
    ).resolves.toBe("Temporary, edited")
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
