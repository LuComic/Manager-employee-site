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
    const result = await t
      .withIdentity(ownerIdentity)
      .query(api.workerNotes.list, {
        hubId,
        now: Date.now(),
      })

    expect(result).toMatchObject({ count: 1, limit: 100 })
    expect(result.notes).toMatchObject([
      {
        id: noteId,
        text: "Restock the front desk",
        pinned: false,
      },
    ])
    expect(
      await t.run(async (ctx) => await ctx.db.get("workerNotes", noteId))
    ).not.toHaveProperty("createdBy")
    await expect(
      t.withIdentity(outsiderIdentity).query(api.workerNotes.list, {
        hubId,
        now: Date.now(),
      })
    ).rejects.toThrow("unauthorized")
  })

  test("lets employees edit and delete shared notes", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const owner = t.withIdentity(ownerIdentity)
    const noteId = await member.mutation(api.workerNotes.create, {
      hubId,
      text: "Original note",
    })

    await owner.mutation(api.workerNotes.updateText, {
      hubId,
      noteId,
      text: "  Updated together  ",
      expectedText: "Original note",
    })
    const updated = await member.query(api.workerNotes.list, {
      hubId,
      now: Date.now(),
    })
    expect(updated.notes).toMatchObject([
      { id: noteId, text: "Updated together" },
    ])

    await member.mutation(api.workerNotes.updateText, {
      hubId,
      noteId,
      text: "",
      expectedText: "Updated together",
    })
    const afterDelete = await owner.query(api.workerNotes.list, {
      hubId,
      now: Date.now(),
    })
    expect(afterDelete.notes).toEqual([])
    expect(afterDelete.count).toBe(0)
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
    await member.mutation(api.workerNotes.setPinned, {
      hubId,
      noteId,
      pinned: true,
    })

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    const whilePinned = await member.query(api.workerNotes.list, {
      hubId,
      now: Date.now(),
    })
    expect(whilePinned.notes).toHaveLength(1)

    await member.mutation(api.workerNotes.setPinned, {
      hubId,
      noteId,
      pinned: false,
    })
    const afterUnpin = await member.query(api.workerNotes.list, {
      hubId,
      now: Date.now(),
    })
    expect(afterUnpin.notes).toEqual([])
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

    const afterExpiry = await member.query(api.workerNotes.list, {
      hubId,
      now: Date.now(),
    })
    expect(afterExpiry.notes).toEqual([])
    expect(
      await t.run(async (ctx) => {
        return await ctx.db.query("workerNotes").take(10)
      })
    ).toEqual([])
  })

  test("does not revive an expired unpinned note before cleanup runs", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"))
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const noteId = await member.mutation(api.workerNotes.create, {
      hubId,
      text: "Already expired",
    })

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1)
    await member.mutation(api.workerNotes.setPinned, {
      hubId,
      noteId,
      pinned: true,
    })

    expect(
      await t.run(async (ctx) => await ctx.db.get("workerNotes", noteId))
    ).toBeNull()
  })

  test("setting a pin state repeatedly is idempotent", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const noteId = await member.mutation(api.workerNotes.create, {
      hubId,
      text: "Pin this once",
    })

    await member.mutation(api.workerNotes.setPinned, {
      hubId,
      noteId,
      pinned: true,
    })
    await member.mutation(api.workerNotes.setPinned, {
      hubId,
      noteId,
      pinned: true,
    })

    const result = await member.query(api.workerNotes.list, {
      hubId,
      now: Date.now(),
    })
    expect(result.notes).toMatchObject([{ id: noteId, pinned: true }])
  })

  test("rejects a stale edit instead of overwriting a newer change", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const owner = t.withIdentity(ownerIdentity)
    const noteId = await member.mutation(api.workerNotes.create, {
      hubId,
      text: "Original",
    })

    await owner.mutation(api.workerNotes.updateText, {
      hubId,
      noteId,
      text: "Coworker update",
      expectedText: "Original",
    })
    await expect(
      member.mutation(api.workerNotes.updateText, {
        hubId,
        noteId,
        text: "Stale update",
        expectedText: "Original",
      })
    ).rejects.toThrow("workerNoteChanged")

    const result = await member.query(api.workerNotes.list, {
      hubId,
      now: Date.now(),
    })
    expect(result.notes).toMatchObject([
      { id: noteId, text: "Coworker update" },
    ])
  })

  test("enforces the workplace note limit and frees a slot after deletion", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const now = Date.now()
    const noteIds = await t.run(async (ctx) => {
      const ids: Id<"workerNotes">[] = []
      for (let index = 0; index < 100; index += 1) {
        ids.push(
          await ctx.db.insert("workerNotes", {
            hubId,
            text: `Note ${index + 1}`,
            pinned: false,
            createdAt: now + index,
            expiresAt: now + 24 * 60 * 60 * 1000 + index,
          })
        )
      }
      return ids
    })

    const atLimit = await member.query(api.workerNotes.list, { hubId, now })
    expect(atLimit).toMatchObject({ count: 100, limit: 100 })
    await expect(
      member.mutation(api.workerNotes.create, {
        hubId,
        text: "One note too many",
      })
    ).rejects.toThrow("workerNoteLimitReached")

    await member.mutation(api.workerNotes.updateText, {
      hubId,
      noteId: noteIds[0],
      text: "",
      expectedText: "Note 1",
    })
    await expect(
      member.mutation(api.workerNotes.create, {
        hubId,
        text: "The freed slot",
      })
    ).resolves.toBeDefined()
  })

  test("keeps the newest notes visible if legacy data exceeds the limit", async () => {
    const t = convexTest(schema, modules)
    const hubId = await createHubWithActiveMember(t)
    const member = t.withIdentity(memberIdentity)
    const now = Date.now()
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("workerNotes", {
          hubId,
          text: `Legacy note ${index + 1}`,
          pinned: false,
          createdAt: now + index,
          expiresAt: now + 24 * 60 * 60 * 1000 + index,
        })
      }
    })

    const result = await member.query(api.workerNotes.list, { hubId, now })

    expect(result).toMatchObject({ count: 100, limit: 100 })
    expect(result.notes).toHaveLength(100)
    expect(result.notes[0]?.text).toBe("Legacy note 2")
    expect(result.notes.at(-1)?.text).toBe("Legacy note 101")
  })
})
