/// <reference types="vite/client" />

import { afterEach, describe, expect, test, vi } from "vitest"
import { convexTest } from "convex-test"

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

afterEach(() => {
  vi.useRealTimers()
})

describe("worker notes", () => {
  test("lets every active employee share notes within their workplace", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)

    const noteId = await member.mutation(api.workerNotes.create, {
      hubId,
      text: "  Restock the front desk  ",
    })
    const notes = await t
      .withIdentity(ownerIdentity)
      .query(api.workerNotes.list, {
        hubId,
        now: Date.now(),
      })

    expect(notes).toMatchObject([
      {
        id: noteId,
        text: "Restock the front desk",
        pinned: false,
      },
    ])
    await expect(
      t.withIdentity(outsiderIdentity).query(api.workerNotes.list, {
        hubId,
        now: Date.now(),
      })
    ).rejects.toThrow("unauthorized")
  })

  test("keeps pinned notes and deletes them when unpinned after 24 hours", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"))
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const noteId = await member.mutation(api.workerNotes.create, {
      hubId,
      text: "Permanent until unpinned",
    })
    await member.mutation(api.workerNotes.togglePinned, { hubId, noteId })

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(
      await member.query(api.workerNotes.list, {
        hubId,
        now: Date.now(),
      })
    ).toHaveLength(1)

    await member.mutation(api.workerNotes.togglePinned, { hubId, noteId })
    expect(
      await member.query(api.workerNotes.list, {
        hubId,
        now: Date.now(),
      })
    ).toEqual([])
  })

  test("permanently deletes an unpinned note after 24 hours", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"))
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    await member.mutation(api.workerNotes.create, {
      hubId,
      text: "Temporary note",
    })

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1)
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    expect(
      await member.query(api.workerNotes.list, {
        hubId,
        now: Date.now(),
      })
    ).toEqual([])
    expect(
      await t.run(async (ctx) => {
        return await ctx.db.query("workerNotes").take(10)
      })
    ).toEqual([])
  })
})
