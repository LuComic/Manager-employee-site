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
  o: { id: "org-a", rol: "admin", slg: "trade-workplace" },
}
const aliceIdentity = {
  subject: "alice-user",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|alice-user",
  o: { id: "org-a", rol: "member", slg: "trade-workplace" },
}
const bobIdentity = {
  subject: "bob-user",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|bob-user",
  o: { id: "org-a", rol: "member", slg: "trade-workplace" },
}

async function setup(t: ReturnType<typeof convexTest>) {
  const { hubId } = await t
    .withIdentity(ownerIdentity)
    .mutation(api.hubs.create, {
      name: "Trade workplace",
      slug: "trade-workplace",
      accessMode: "public",
      joinCode: "TRAD-E123",
      privateToken: "trade-private-token-that-is-long-enough",
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
  await t.mutation(internal.deputy.applyRosterBatch, {
    connectionId,
    generation: 1,
    syncId: "sync-1",
    rosters: [
      {
        externalId: "101",
        startUtc: "2030-09-15T06:00:00.000Z",
        endUtc: "2030-09-15T14:00:00.000Z",
        employeeId: "11",
        employeeName: "Alice Worker",
        areaId: "3",
        areaName: "Kitchen",
        published: true,
      },
      {
        externalId: "102",
        startUtc: "2030-09-16T08:00:00.000Z",
        endUtc: "2030-09-16T16:00:00.000Z",
        employeeId: "12",
        employeeName: "Bob Worker",
        areaId: "4",
        areaName: "Front desk",
        published: true,
      },
    ],
  })
  await t.mutation(internal.deputy.finishSync, {
    connectionId,
    generation: 1,
    syncId: "sync-1",
  })
  const records = await t.run(async (ctx) => {
    const mappings = await ctx.db.query("deputyEmployeeMappings").take(10)
    const aliceMapping = mappings.find(
      (mapping) => mapping.hubId === hubId && mapping.deputyEmployeeId === "11"
    )
    const bobMapping = mappings.find(
      (mapping) => mapping.hubId === hubId && mapping.deputyEmployeeId === "12"
    )
    if (!aliceMapping || !bobMapping) throw new Error("Missing mappings")
    await ctx.db.patch("employeeProfiles", aliceMapping.employeeProfileId, {
      clerkUserId: aliceIdentity.subject,
      status: "active",
      accessLevel: "manager",
    })
    await ctx.db.patch("employeeProfiles", bobMapping.employeeProfileId, {
      clerkUserId: bobIdentity.subject,
      status: "active",
      accessLevel: "manager",
    })
    const shifts = await ctx.db.query("events").take(10)
    const aliceShift = shifts.find(
      (shift) => shift.hubId === hubId && shift.slug === "deputy-shift-101"
    )
    const bobShift = shifts.find(
      (shift) => shift.hubId === hubId && shift.slug === "deputy-shift-102"
    )
    if (!aliceShift || !bobShift) throw new Error("Missing shifts")
    return {
      aliceId: aliceMapping.employeeProfileId,
      bobId: bobMapping.employeeProfileId,
      aliceShiftId: aliceShift._id,
      bobShiftId: bobShift._id,
    }
  })
  return { hubId, connectionId, ...records }
}

async function confirmedTrade(
  t: ReturnType<typeof convexTest>,
  setupResult: Awaited<ReturnType<typeof setup>>
) {
  const { hubId, aliceShiftId, bobShiftId } = setupResult
  const owner = t.withIdentity(ownerIdentity)
  await owner.mutation(api.hubs.setWorkersCanEdit, {
    hubId,
    section: "trades",
    enabled: true,
  })
  const slug = await t.withIdentity(aliceIdentity).mutation(api.trades.create, {
    hubId,
    sourceEventId: aliceShiftId,
    reason: "I have a birthday party and need to switch.",
  })
  const listed = await t.withIdentity(bobIdentity).query(api.trades.list, {
    hubId,
  })
  expect(listed).toHaveLength(1)
  await t.withIdentity(bobIdentity).mutation(api.trades.offer, {
    tradeId: listed[0].id,
    eventId: bobShiftId,
  })
  await t.withIdentity(aliceIdentity).mutation(api.trades.respondToOffer, {
    tradeId: listed[0].id,
    response: "accept",
  })
  return { tradeId: listed[0].id, slug }
}

describe("shift trades", () => {
  test("keeps manager events free of Deputy shifts while retaining employee schedules", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await setup(t)
    const owner = t.withIdentity(ownerIdentity)
    const managerSnapshot = await owner.query(api.hubs.getManagerSnapshot, {
      nowDate: "2030-09-01",
    })
    if (managerSnapshot.kind !== "ready") throw new Error("Expected snapshot")
    expect(managerSnapshot.events).toEqual([])
    expect(
      managerSnapshot.categories.some(
        (category) => category.id === "deputy-schedules"
      )
    ).toBe(false)

    const employeeSnapshot = await owner.query(api.hubs.getPublicSnapshot, {
      slug: "trade-workplace",
      nowDate: "2030-09-01",
    })
    if (employeeSnapshot.kind !== "ready") throw new Error("Expected snapshot")
    expect(employeeSnapshot.events).toHaveLength(2)
    expect(
      employeeSnapshot.events.every((event) => event.source === "deputy")
    ).toBe(true)
    await expect(
      owner.query(api.schedules.listForManager, { hubId })
    ).resolves.toHaveLength(2)
  })

  test("does not let deleted schedule history consume the active schedule limit", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await setup(t)
    await t.run(async (ctx) => {
      const category = await ctx.db
        .query("categories")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "deputy-schedules")
        )
        .unique()
      if (!category) throw new Error("Missing schedule category")
      for (let index = 0; index < 500; index += 1) {
        await ctx.db.insert("events", {
          hubId,
          slug: `deleted-schedule-${index}`,
          title: "Former worker",
          description: "Deleted Deputy schedule",
          categoryId: category._id,
          start: `2029-01-${String((index % 28) + 1).padStart(2, "0")}T01:00`,
          end: `2029-01-${String((index % 28) + 1).padStart(2, "0")}T02:00`,
          location: "Old area",
          notes: "",
          published: false,
          source: "deputy",
          sourceDeleted: true,
        })
      }
    })

    const schedules = await t
      .withIdentity(ownerIdentity)
      .query(api.schedules.listForManager, { hubId })
    expect(schedules).toHaveLength(2)
    expect(schedules.map((schedule) => schedule.slug)).toEqual([
      "deputy-shift-101",
      "deputy-shift-102",
    ])
  })

  test("keeps ordinary manager events outside the Deputy snapshot budget", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await setup(t)
    await t.run(async (ctx) => {
      const category = await ctx.db
        .query("categories")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "deputy-schedules")
        )
        .unique()
      if (!category) throw new Error("Missing schedule category")
      for (let index = 0; index < 1_000; index += 1) {
        await ctx.db.insert("events", {
          hubId,
          slug: `snapshot-schedule-${index}`,
          title: "Worker",
          description: "Deputy schedule",
          categoryId: category._id,
          start: `2029-01-${String((index % 28) + 1).padStart(2, "0")}T03:00`,
          end: `2029-01-${String((index % 28) + 1).padStart(2, "0")}T04:00`,
          location: "Area",
          notes: "",
          published: true,
          source: "deputy",
        })
      }
      const ordinaryCategoryId = await ctx.db.insert("categories", {
        hubId,
        slug: "ordinary-events",
        label: "Ordinary events",
        iconKey: "calendar",
        description: "Manager calendar events",
        order: 2,
        kind: "event",
      })
      await ctx.db.insert("events", {
        hubId,
        slug: "ordinary-manager-event",
        title: "Ordinary event",
        description: "Must remain in the manager snapshot",
        categoryId: ordinaryCategoryId,
        start: "2031-01-01T10:00",
        end: "2031-01-01T11:00",
        location: "Office",
        notes: "",
        published: true,
      })
    })

    const snapshot = await t
      .withIdentity(ownerIdentity)
      .query(api.hubs.getManagerSnapshot, { nowDate: "2030-09-01" })
    if (snapshot.kind !== "ready") throw new Error("Expected snapshot")
    expect(snapshot.events.map((event) => event.id)).toContain(
      "ordinary-manager-event"
    )
  })

  test("enforces the feature toggle and completes employee and manager review", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceShiftId } = setupResult
    await expect(
      t.withIdentity(aliceIdentity).mutation(api.trades.create, {
        hubId,
        sourceEventId: aliceShiftId,
        reason: "Please switch.",
      })
    ).rejects.toThrow("tradesNotEnabled")

    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    const managerTrade = await t
      .withIdentity(ownerIdentity)
      .query(api.trades.get, {
        hubId,
        slug,
      })
    expect(managerTrade).toMatchObject({
      id: tradeId,
      status: "confirmed",
      viewerRole: "manager",
      offeredShift: { employeeName: "Bob Worker" },
    })
    const managerFeed = await t
      .withIdentity(ownerIdentity)
      .query(api.notifications.listManager, { hubId })
    expect(managerFeed.notifications[0]).toMatchObject({
      kind: "trade",
      messageKey: "notificationEmployeesWantTrade",
      href: `/trades/${slug}`,
    })
    await t.mutation(api.content.submitHelpRequest, {
      hubSlug: "trade-workplace",
      topic: "Private owner topic",
      message: "Full-access employees must not see this owner-only request.",
    })
    const fullAccessFeed = await t
      .withIdentity(aliceIdentity)
      .query(api.notifications.listManager, { hubId })
    expect(fullAccessFeed.notifications).toHaveLength(1)
    expect(fullAccessFeed.notifications[0]?.kind).toBe("trade")
    const ownerFeed = await t
      .withIdentity(ownerIdentity)
      .query(api.notifications.listManager, { hubId })
    expect(
      ownerFeed.notifications.some((item) => item.kind === "question")
    ).toBe(true)

    await t.withIdentity(ownerIdentity).mutation(api.trades.managerDecline, {
      tradeId,
      reason: "The shifts overlap required training.",
    })
    const declined = await t.withIdentity(aliceIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    expect(declined).toMatchObject({
      status: "manager-declined",
      managerDeclineReason: "The shifts overlap required training.",
    })
    const aliceFeed = await t
      .withIdentity(aliceIdentity)
      .query(api.notifications.listEmployee, { hubSlug: "trade-workplace" })
    expect(aliceFeed.notifications[0]).toMatchObject({
      titleKey: "notificationManagerDeclinedTrade",
    })
  })

  test("keeps each shift in at most one active trade", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceShiftId, bobShiftId } = await setup(t)
    await t.withIdentity(ownerIdentity).mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    await t.withIdentity(aliceIdentity).mutation(api.trades.create, {
      hubId,
      sourceEventId: aliceShiftId,
      reason: "I need to switch this shift.",
    })
    const bobTradeSlug = await t
      .withIdentity(bobIdentity)
      .mutation(api.trades.create, {
        hubId,
        sourceEventId: bobShiftId,
        reason: "I also need to switch.",
      })
    const trades = await t.withIdentity(bobIdentity).query(api.trades.list, {
      hubId,
    })
    const aliceTrade = trades.find(
      (trade) => trade.publisherName === "Alice Worker"
    )
    const bobTrade = trades.find((trade) => trade.slug === bobTradeSlug)
    if (!aliceTrade || !bobTrade) throw new Error("Missing trades")

    await expect(
      t.withIdentity(bobIdentity).mutation(api.trades.offer, {
        tradeId: aliceTrade.id,
        eventId: bobShiftId,
      })
    ).rejects.toThrow("tradeAlreadyPublishedForShift")

    await t.withIdentity(bobIdentity).mutation(api.trades.unpublish, {
      tradeId: bobTrade.id,
    })
    await t.withIdentity(bobIdentity).mutation(api.trades.offer, {
      tradeId: aliceTrade.id,
      eventId: bobShiftId,
    })
    await expect(
      t.withIdentity(bobIdentity).mutation(api.trades.create, {
        hubId,
        sourceEventId: bobShiftId,
        reason: "This offered shift must not be published twice.",
      })
    ).rejects.toThrow("tradeAlreadyPublishedForShift")
  })

  test("requires full employee access even when shift trades are enabled", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceId, aliceShiftId } = await setup(t)
    await t.withIdentity(ownerIdentity).mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    await t.run((ctx) =>
      ctx.db.patch("employeeProfiles", aliceId, { accessLevel: "editor" })
    )

    await expect(
      t.withIdentity(aliceIdentity).mutation(api.trades.create, {
        hubId,
        sourceEventId: aliceShiftId,
        reason: "Editors must not bypass the toggle access policy.",
      })
    ).rejects.toThrow("tradesNotEnabled")
  })

  test("applies an approved trade to both synchronized schedules", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceId, bobId, aliceShiftId, bobShiftId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    await t.run(async (ctx) => {
      await ctx.db.patch("shiftTrades", tradeId, { status: "processing" })
    })
    await t
      .withIdentity(ownerIdentity)
      .mutation(internal.trades.finishApproval, { tradeId })

    const result = await t.run(async (ctx) => {
      const [aliceShift, bobShift, aliceAssignment, bobAssignment] =
        await Promise.all([
          ctx.db.get("events", aliceShiftId),
          ctx.db.get("events", bobShiftId),
          ctx.db
            .query("eventEmployees")
            .withIndex("by_eventId_and_employeeProfileId", (q) =>
              q.eq("eventId", aliceShiftId).eq("employeeProfileId", bobId)
            )
            .unique(),
          ctx.db
            .query("eventEmployees")
            .withIndex("by_eventId_and_employeeProfileId", (q) =>
              q.eq("eventId", bobShiftId).eq("employeeProfileId", aliceId)
            )
            .unique(),
        ])
      return { aliceShift, bobShift, aliceAssignment, bobAssignment }
    })
    expect(result.aliceShift).toMatchObject({
      title: "Bob Worker",
      sourceEmployeeId: "12",
    })
    expect(result.bobShift).toMatchObject({
      title: "Alice Worker",
      sourceEmployeeId: "11",
    })
    expect(result.aliceAssignment).not.toBeNull()
    expect(result.bobAssignment).not.toBeNull()
    const approved = await t.withIdentity(ownerIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    expect(approved?.status).toBe("approved")
  })

  test("updates both Deputy rosters and preserves live roster settings", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, connectionId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    const posts: Record<string, unknown>[] = []
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input)
        if (url.endsWith("/Roster/101")) {
          return Response.json({
            Id: 101,
            Employee: 11,
            StartTime: 1915682400,
            EndTime: 1915711200,
            OperationalUnit: 3,
            Published: true,
            Mealbreak: "2030-09-15T00:30:00+03:00",
            Open: false,
            ConfirmStatus: 2,
            ConnectStatus: 0,
          })
        }
        if (url.endsWith("/Roster/102")) {
          return Response.json({
            Id: 102,
            Employee: 12,
            StartTime: 1915776000,
            EndTime: 1915804800,
            OperationalUnit: 4,
            Published: true,
            Mealbreak: "2030-09-16T00:45:00+03:00",
            Open: false,
            ConfirmStatus: 1,
            ConnectStatus: 0,
          })
        }
        if (
          url.endsWith("/api/v1/supervise/roster") &&
          init?.method === "POST"
        ) {
          posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
          return new Response(null, { status: 200 })
        }
        return new Response(null, { status: 404 })
      })
    try {
      await t
        .withIdentity(ownerIdentity)
        .action(api.tradeApproval.approve, { tradeId })
    } finally {
      fetchMock.mockRestore()
    }

    expect(posts).toEqual([
      expect.objectContaining({
        intRosterId: 101,
        intRosterEmployee: 12,
        intMealbreakMinute: 30,
        intConfirmStatus: 2,
      }),
      expect.objectContaining({
        intRosterId: 102,
        intRosterEmployee: 11,
        intMealbreakMinute: 45,
        intConfirmStatus: 1,
      }),
    ])
    const approved = await t.withIdentity(ownerIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    expect(approved?.status).toBe("approved")
    const connection = await t.run((ctx) =>
      ctx.db.get("deputyConnections", connectionId)
    )
    expect(connection).toMatchObject({ status: "syncing" })
    expect(connection?.activeSyncId).toBeTruthy()
  })

  test("rejects materially changed live Deputy shifts before writing", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input)
        if (url.endsWith("/Roster/101")) {
          return Response.json({
            Id: 101,
            Employee: 11,
            StartTime: 1915682400,
            EndTime: 1915711200,
            OperationalUnit: 999,
            Published: true,
          })
        }
        if (url.endsWith("/Roster/102")) {
          return Response.json({
            Id: 102,
            Employee: 12,
            StartTime: 1915776000,
            EndTime: 1915804800,
            OperationalUnit: 4,
            Published: true,
          })
        }
        return new Response(null, { status: 500 })
      })
    try {
      await expect(
        t
          .withIdentity(ownerIdentity)
          .action(api.tradeApproval.approve, { tradeId })
      ).rejects.toThrow("deputyShiftTradeStale")
    } finally {
      fetchMock.mockRestore()
    }
    const trade = await t.withIdentity(ownerIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    expect(trade?.status).toBe("confirmed")
  })

  test("resumes finalization after Deputy already swapped both rosters", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    await t.run((ctx) =>
      ctx.db.patch("shiftTrades", tradeId, { status: "processing" })
    )
    const posts: unknown[] = []
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input)
        if (url.endsWith("/Roster/101")) {
          return Response.json({
            Id: 101,
            Employee: 12,
            StartTime: 1915682400,
            EndTime: 1915711200,
            OperationalUnit: 3,
            Published: true,
          })
        }
        if (url.endsWith("/Roster/102")) {
          return Response.json({
            Id: 102,
            Employee: 11,
            StartTime: 1915776000,
            EndTime: 1915804800,
            OperationalUnit: 4,
            Published: true,
          })
        }
        if (
          url.endsWith("/api/v1/supervise/roster") &&
          init?.method === "POST"
        ) {
          posts.push(init.body)
        }
        return new Response(null, { status: 200 })
      })
    try {
      await t
        .withIdentity(ownerIdentity)
        .action(api.tradeApproval.approve, { tradeId })
    } finally {
      fetchMock.mockRestore()
    }
    expect(posts).toEqual([])
    const trade = await t.withIdentity(ownerIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    expect(trade?.status).toBe("approved")
  })

  test("prevents employee removal while shift trades reference the profile", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { aliceId } = setupResult
    await confirmedTrade(t, setupResult)

    await expect(
      t
        .withIdentity(ownerIdentity)
        .mutation(api.employees.removeProfileBatch, { profileId: aliceId })
    ).rejects.toThrow("employeeHasShiftTrades")
  })
})
