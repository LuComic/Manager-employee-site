/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api, internal } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "owner-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-a",
  o: { id: "org-a", rol: "admin", slg: "workplace-a" },
}

async function setup(t: ReturnType<typeof convexTest>) {
  const { hubId } = await t
    .withIdentity(ownerIdentity)
    .mutation(api.hubs.create, {
      name: "Deputy workplace",
      slug: "deputy-workplace",
      accessMode: "public",
      joinCode: "DEPU-TY12",
      privateToken: "deputy-private-token-that-is-long-enough",
      timeZone: "Europe/Tallinn",
    })
  const connectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("deputyConnections", {
      hubId,
      endpoint: "example.eu.deputy.com",
      tokenCiphertext: "not-used-by-this-test",
      tokenInitializationVector: "not-used-by-this-test",
      tokenVersion: 1,
      generation: 1,
      accessTokenExpiresAt: Date.now() + 60_000,
      status: "syncing",
      connectedAt: Date.now(),
      connectedBy: ownerIdentity.subject,
      activeSyncId: "sync-1",
      syncStartedAt: Date.now(),
    })
  })
  return { hubId, connectionId }
}

describe("Deputy schedule synchronization", () => {
  test("keeps manager-deleted worker schedules hidden after a later sync", async () => {
    const t = convexTest(schema, modules)
    const { hubId, connectionId } = await setup(t)
    await t.mutation(internal.deputy.applyRosterBatch, {
      connectionId,
      generation: 1,
      syncId: "sync-1",
      rosters: [
        {
          externalId: "delete-me",
          startUtc: "2026-08-04T06:00:00.000Z",
          endUtc: "2026-08-04T14:00:00.000Z",
          employeeId: "7",
          employeeName: "Alice Worker",
          areaId: "3",
          areaName: "Kitchen",
          published: true,
        },
      ],
    })

    await expect(
      t.withIdentity(ownerIdentity).mutation(api.content.deleteEvent, {
        hubId,
        slug: "deputy-shift-delete-me",
      })
    ).resolves.toBeNull()

    const deleted = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "deputy-shift-delete-me")
        )
        .unique()
    )
    expect(deleted).toMatchObject({
      managerDeleted: true,
      published: false,
      source: "deputy",
    })
    expect(
      await t.run((ctx) => ctx.db.query("eventEmployees").take(10))
    ).toHaveLength(0)

    await t.run(async (ctx) => {
      await ctx.db.patch("deputyConnections", connectionId, {
        activeSyncId: "sync-2",
      })
    })
    await expect(
      t.mutation(internal.deputy.applyRosterBatch, {
        connectionId,
        generation: 1,
        syncId: "sync-2",
        rosters: [
          {
            externalId: "delete-me",
            startUtc: "2026-08-05T07:00:00.000Z",
            endUtc: "2026-08-05T15:00:00.000Z",
            employeeId: "8",
            employeeName: "Bob Worker",
            areaId: "4",
            areaName: "Front desk",
            published: true,
          },
        ],
      })
    ).resolves.toBe(true)

    const afterResync = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "deputy-shift-delete-me")
        )
        .unique()
    )
    expect(afterResync).toMatchObject({
      managerDeleted: true,
      published: false,
      title: "Alice Worker",
    })
    expect(
      await t.run((ctx) => ctx.db.query("eventEmployees").take(10))
    ).toHaveLength(0)

    const snapshot = await t
      .withIdentity(ownerIdentity)
      .query(api.hubs.getManagerSnapshot, { nowDate: "2026-08-03" })
    if (snapshot.kind !== "ready") throw new Error("Expected manager snapshot")
    expect(snapshot.events).toEqual([])
  })

  test("keeps local privacy while Deputy updates schedule-owned fields", async () => {
    const t = convexTest(schema, modules)
    const { hubId, connectionId } = await setup(t)
    await t.mutation(internal.deputy.applyRosterBatch, {
      connectionId,
      generation: 1,
      syncId: "sync-1",
      rosters: [
        {
          externalId: "42",
          startUtc: "2026-08-04T06:00:00.000Z",
          endUtc: "2026-08-04T14:00:00.000Z",
          employeeId: "7",
          employeeName: "Alice Worker",
          areaId: "3",
          areaName: "Kitchen",
          published: true,
        },
      ],
    })
    const owner = t.withIdentity(ownerIdentity)
    const initial = await owner.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-08-03",
    })
    if (initial.kind !== "ready") throw new Error("Expected manager snapshot")
    expect(initial.events[0]).toMatchObject({
      id: "deputy-shift-42",
      title: "Alice Worker",
      location: "Kitchen",
      published: true,
      isPrivate: true,
      source: "deputy",
    })

    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "deputy-shift-42",
      title: "Manager cannot replace this",
      description: "Local calendar description",
      category: "deputy-schedules",
      start: "2030-01-01T00:00",
      end: "2030-01-01T01:00",
      location: "Manager cannot replace this",
      employeeProfileIds: [],
      notes: "Local manager note",
      published: false,
      isPrivate: false,
      guideSlugs: [],
    })
    await t.run(async (ctx) => {
      await ctx.db.patch("deputyConnections", connectionId, {
        activeSyncId: "sync-2",
      })
    })
    await t.mutation(internal.deputy.applyRosterBatch, {
      connectionId,
      generation: 1,
      syncId: "sync-2",
      rosters: [
        {
          externalId: "42",
          startUtc: "2026-08-05T07:00:00.000Z",
          endUtc: "2026-08-05T15:00:00.000Z",
          employeeId: "8",
          employeeName: "Bob Worker",
          areaId: "4",
          areaName: "Front desk",
          published: false,
        },
      ],
    })

    const updated = await owner.query(api.hubs.getManagerSnapshot, {
      nowDate: "2026-08-03",
    })
    if (updated.kind !== "ready") throw new Error("Expected manager snapshot")
    expect(updated.events[0]).toMatchObject({
      id: "deputy-shift-42",
      title: "Bob Worker",
      description: "Local calendar description",
      startUtc: "2026-08-05T07:00:00.000Z",
      endUtc: "2026-08-05T15:00:00.000Z",
      location: "Front desk",
      notes: "Local manager note",
      published: false,
      isPrivate: false,
      source: "deputy",
    })
    expect(updated.events[0].employees).toEqual([
      expect.objectContaining({ displayName: "Bob Worker" }),
    ])
  })

  test("ignores batches from superseded connections and sync runs", async () => {
    const t = convexTest(schema, modules)
    const { hubId, connectionId } = await setup(t)
    const roster = {
      externalId: "stale",
      startUtc: "2026-08-04T06:00:00.000Z",
      endUtc: "2026-08-04T14:00:00.000Z",
      employeeId: "7",
      employeeName: "Stale Worker",
      areaId: "3",
      areaName: "Old installation",
      published: true,
    }

    await expect(
      t.mutation(internal.deputy.applyRosterBatch, {
        connectionId,
        generation: 0,
        syncId: "sync-1",
        rosters: [roster],
      })
    ).resolves.toBe(false)
    await expect(
      t.mutation(internal.deputy.applyRosterBatch, {
        connectionId,
        generation: 1,
        syncId: "older-run",
        rosters: [roster],
      })
    ).resolves.toBe(false)

    const events = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .withIndex("by_hubId_and_start", (q) => q.eq("hubId", hubId))
        .take(10)
    )
    expect(events).toEqual([])
  })
})
