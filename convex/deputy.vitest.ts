/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test, vi } from "vitest"

import { api, internal } from "./_generated/api"
import schema from "./schema"
import { encryptDeputyTokens } from "./lib/deputyCredentials"

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
  const encrypted = await encryptDeputyTokens({
    hubId,
    tokenVersion: 1,
    tokens: { accessToken: "access-token", refreshToken: "refresh-token" },
  })
  const connectionId = await t.run(async (ctx) => {
    return await ctx.db.insert("deputyConnections", {
      hubId,
      endpoint: "example.eu.deputy.com",
      ...encrypted,
      tokenVersion: 1,
      generation: 1,
      accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
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
  test("matches an existing Workhal employee by email without guessing by name", async () => {
    const t = convexTest(schema, modules)
    const { hubId, connectionId } = await setup(t)
    const owner = t.withIdentity(ownerIdentity)
    const matchingProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Tom Y.",
      email: "tom@example.com",
    })
    const misleadingProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Tom Yankens",
      email: "someone-else@example.com",
    })
    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", matchingProfileId, {
        clerkUserId: "tom-workhal",
        normalizedEmail: undefined,
        status: "active",
      })
      await ctx.db.patch("employeeProfiles", misleadingProfileId, {
        clerkUserId: "other-tom-workhal",
        status: "active",
      })
    })

    const startTime = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000)
    const employeeRequestBodies: Record<string, unknown>[] = []
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input)
        if (url.endsWith("/api/v1/resource/Roster/QUERY")) {
          return Response.json([
            {
              Id: "tom-shift",
              StartTime: startTime,
              EndTime: startTime + 8 * 60 * 60,
              Employee: 7,
              OperationalUnit: 3,
              Published: true,
              EmployeeObject: { DisplayName: "Tom Yankens" },
              OperationalUnitObject: { OperationalUnitName: "Kitchen" },
            },
          ])
        }
        if (url.endsWith("/api/v1/resource/Employee/QUERY")) {
          employeeRequestBodies.push(
            JSON.parse(String(init?.body)) as Record<string, unknown>
          )
          return Response.json([
            {
              Id: 7,
              DisplayName: "Tom Yankens",
              ContactObject: {
                Email1: " TOM@EXAMPLE.COM ",
                PrimaryEmail: 1,
              },
            },
          ])
        }
        return new Response(null, { status: 404 })
      })
    try {
      await t.action(internal.deputySync.syncConnection, {
        connectionId,
        generation: 1,
        syncId: "sync-1",
      })
    } finally {
      fetchMock.mockRestore()
    }
    expect(employeeRequestBodies).toEqual([
      {
        search: { s1: { field: "Id", data: ["7"], type: "in" } },
        join: ["ContactObject"],
        max: 1,
      },
    ])

    const result = await t.run(async (ctx) => {
      const mapping = await ctx.db
        .query("deputyEmployeeMappings")
        .withIndex("by_hubId_and_deputyEmployeeId", (q) =>
          q.eq("hubId", hubId).eq("deputyEmployeeId", "7")
        )
        .unique()
      const event = await ctx.db
        .query("events")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "deputy-shift-tom-shift")
        )
        .unique()
      const assignment = event
        ? await ctx.db
            .query("eventEmployees")
            .withIndex("by_eventId_and_employeeProfileId", (q) =>
              q.eq("eventId", event._id)
            )
            .unique()
        : null
      const connection = await ctx.db.get("deputyConnections", connectionId)
      return { mapping, assignment, connection }
    })
    expect(result.mapping?.employeeProfileId).toBe(matchingProfileId)
    expect(result.assignment?.employeeProfileId).toBe(matchingProfileId)
    expect(result.connection?.status).toBe("connected")

    const employees = await owner.query(api.employees.list, { hubId })
    expect(employees).toHaveLength(2)
    expect(
      employees.find((employee) => employee.id === matchingProfileId)
    ).toMatchObject({
      displayName: "Tom Y.",
      email: "tom@example.com",
      status: "active",
    })
  })

  test("creates an unclaimed Deputy employee that managers can see", async () => {
    const t = convexTest(schema, modules)
    const { hubId, connectionId } = await setup(t)

    await expect(
      t.mutation(internal.deputy.applyRosterBatch, {
        connectionId,
        generation: 1,
        syncId: "sync-1",
        rosters: [
          {
            externalId: "new-worker-shift",
            startUtc: "2026-08-04T06:00:00.000Z",
            endUtc: "2026-08-04T14:00:00.000Z",
            employeeId: "8",
            employeeName: "New Deputy Worker",
            employeeEmail: "new.worker@example.com",
            areaId: "3",
            areaName: "Kitchen",
            published: true,
          },
        ],
      })
    ).resolves.toBe(true)

    const employees = await t
      .withIdentity(ownerIdentity)
      .query(api.employees.list, { hubId })
    expect(employees).toEqual([
      expect.objectContaining({
        displayName: "New Deputy Worker",
        email: "new.worker@example.com",
        status: "unclaimed",
        invitationStatus: "not-sent",
      }),
    ])
  })

  test("does not map Deputy employees from separate sync windows to one email-matched profile", async () => {
    const t = convexTest(schema, modules)
    const { hubId, connectionId } = await setup(t)
    const sharedProfileId = await t
      .withIdentity(ownerIdentity)
      .mutation(api.employees.create, {
        hubId,
        displayName: "Shared Email Profile",
        email: "shared@example.com",
      })

    for (const [employeeId, externalId, employeeName] of [
      ["7", "first-window", "First Deputy Worker"],
      ["8", "second-window", "Second Deputy Worker"],
    ] as const) {
      await t.mutation(internal.deputy.applyRosterBatch, {
        connectionId,
        generation: 1,
        syncId: "sync-1",
        rosters: [
          {
            externalId,
            startUtc: "2026-08-04T06:00:00.000Z",
            endUtc: "2026-08-04T14:00:00.000Z",
            employeeId,
            employeeName,
            employeeEmail: "shared@example.com",
            areaId: "3",
            areaName: "Kitchen",
            published: true,
          },
        ],
      })
    }

    const mappings = await t.run((ctx) =>
      ctx.db
        .query("deputyEmployeeMappings")
        .withIndex("by_hubId_and_deputyEmployeeId", (q) => q.eq("hubId", hubId))
        .take(10)
    )
    expect(mappings).toHaveLength(2)
    expect(
      new Set(mappings.map((mapping) => mapping.employeeProfileId)).size
    ).toBe(2)
    expect(
      mappings.filter(
        (mapping) => mapping.employeeProfileId === sharedProfileId
      )
    ).toHaveLength(1)
  })

  test("does not duplicate a profile mapping beyond the first 500 hub mappings", async () => {
    const t = convexTest(schema, modules)
    const { hubId, connectionId } = await setup(t)
    const owner = t.withIdentity(ownerIdentity)
    const existingProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Existing Worker",
      email: "existing@example.com",
    })
    const fillerProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Filler Worker",
      email: "filler@example.com",
    })
    await t.run(async (ctx) => {
      for (let index = 0; index < 500; index += 1) {
        await ctx.db.insert("deputyEmployeeMappings", {
          hubId,
          deputyEmployeeId: `filler-${String(index).padStart(4, "0")}`,
          employeeProfileId: fillerProfileId,
        })
      }
      await ctx.db.insert("deputyEmployeeMappings", {
        hubId,
        deputyEmployeeId: "zz-existing",
        employeeProfileId: existingProfileId,
      })
    })

    await expect(
      t.mutation(internal.deputy.applyRosterBatch, {
        connectionId,
        generation: 1,
        syncId: "sync-1",
        rosters: [
          {
            externalId: "new-worker-shift",
            startUtc: "2026-08-04T06:00:00.000Z",
            endUtc: "2026-08-04T14:00:00.000Z",
            employeeId: "new-deputy-worker",
            employeeName: "Existing Worker",
            employeeEmail: "existing@example.com",
            areaId: "3",
            areaName: "Kitchen",
            published: true,
          },
        ],
      })
    ).resolves.toBe(true)

    const mappings = await t.run(async (ctx) => {
      const newMapping = await ctx.db
        .query("deputyEmployeeMappings")
        .withIndex("by_hubId_and_deputyEmployeeId", (q) =>
          q
            .eq("hubId", hubId)
            .eq("deputyEmployeeId", "new-deputy-worker")
        )
        .unique()
      const existingProfileMappings = await ctx.db
        .query("deputyEmployeeMappings")
        .withIndex("by_hubId_and_deputyEmployeeId", (q) =>
          q.eq("hubId", hubId)
        )
        .filter((q) =>
          q.eq(q.field("employeeProfileId"), existingProfileId)
        )
        .collect()
      return { newMapping, existingProfileMappings }
    })
    expect(mappings.newMapping?.employeeProfileId).not.toBe(existingProfileId)
    expect(mappings.existingProfileMappings).toHaveLength(1)
  })

  test("queues one follow-up sync when a trade completes during an active sync", async () => {
    const t = convexTest(schema, modules)
    const { connectionId } = await setup(t)
    const owner = t.withIdentity(ownerIdentity)

    await expect(
      owner.mutation(internal.deputy.queueSyncAfterTrade, { connectionId })
    ).resolves.toBe(true)
    const pending = await t.run((ctx) =>
      ctx.db.get("deputyConnections", connectionId)
    )
    expect(pending?.resyncRequested).toBe(true)

    await expect(
      t.mutation(internal.deputy.finishSync, {
        connectionId,
        generation: 1,
        syncId: "sync-1",
      })
    ).resolves.toBe(true)
    const followUp = await t.run((ctx) =>
      ctx.db.get("deputyConnections", connectionId)
    )
    expect(followUp).toMatchObject({ status: "syncing" })
    expect(followUp?.resyncRequested).toBeUndefined()
    expect(followUp?.activeSyncId).toBeTruthy()
    expect(followUp?.activeSyncId).not.toBe("sync-1")
  })

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
    const initial = await owner.query(api.hubs.getPublicSnapshot, {
      slug: "deputy-workplace",
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

    const updated = await t.run(async (ctx) =>
      ctx.db
        .query("events")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "deputy-shift-42")
        )
        .unique()
    )
    expect(updated).toMatchObject({
      slug: "deputy-shift-42",
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
    const assignments = await t.run(async (ctx) =>
      ctx.db
        .query("eventEmployees")
        .withIndex("by_hubId_and_eventId", (q) => q.eq("hubId", hubId))
        .take(10)
    )
    const assignedEmployees = await t.run(async (ctx) =>
      Promise.all(
        assignments.map((assignment) =>
          ctx.db.get("employeeProfiles", assignment.employeeProfileId)
        )
      )
    )
    expect(assignedEmployees).toEqual([
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
