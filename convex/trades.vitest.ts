/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { afterEach, describe, expect, test, vi } from "vitest"

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

afterEach(() => {
  vi.useRealTimers()
})

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
    paginationOpts: { numItems: 50, cursor: null },
  })
  expect(listed.page).toHaveLength(1)
  await t.withIdentity(bobIdentity).mutation(api.trades.offer, {
    tradeId: listed.page[0].id,
    eventId: bobShiftId,
  })
  await t.withIdentity(aliceIdentity).mutation(api.trades.respondToOffer, {
    tradeId: listed.page[0].id,
    response: "accept",
  })
  return { tradeId: listed.page[0].id, slug }
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
      for (let index = 0; index < 1_000; index += 1) {
        await ctx.db.insert("events", {
          hubId,
          slug: `deleted-schedule-${index}`,
          title: "Former worker",
          description: "Deleted Deputy schedule",
          categoryId: category._id,
          start: `2031-01-${String((index % 28) + 1).padStart(2, "0")}T01:00`,
          end: `2031-01-${String((index % 28) + 1).padStart(2, "0")}T02:00`,
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

  test("cleans trade notifications beyond the first 100 audience rows", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceShiftId } = await setup(t)
    await t.withIdentity(ownerIdentity).mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("notifications", {
          hubId,
          audience: "trade-employees",
          kind: "trade",
          titleKey: "notificationNewShiftTrade",
          href: `/trades/archive-${index}`,
        })
      }
    })
    const slug = await t
      .withIdentity(aliceIdentity)
      .mutation(api.trades.create, {
        hubId,
        sourceEventId: aliceShiftId,
        reason: "I need to switch this shift.",
      })
    const trade = await t.run((ctx) =>
      ctx.db
        .query("shiftTrades")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", slug)
        )
        .unique()
    )
    if (!trade) throw new Error("Missing trade")

    await t.withIdentity(aliceIdentity).mutation(api.trades.unpublish, {
      tradeId: trade._id,
    })

    const notifications = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_hubId_and_audience", (q) =>
          q.eq("hubId", hubId).eq("audience", "trade-employees")
        )
        .filter((q) => q.eq(q.field("shiftTradeId"), trade._id))
        .collect()
    )
    expect(notifications).toEqual([])
  })

  test("replaces an offer notification when the publisher declines", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceShiftId, bobShiftId, bobId } = await setup(t)
    await t.withIdentity(ownerIdentity).mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    const slug = await t
      .withIdentity(aliceIdentity)
      .mutation(api.trades.create, {
        hubId,
        sourceEventId: aliceShiftId,
        reason: "I need to switch this shift.",
      })
    const trade = await t.run((ctx) =>
      ctx.db
        .query("shiftTrades")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", slug)
        )
        .unique()
    )
    if (!trade) throw new Error("Missing trade")
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("notifications", {
          hubId,
          audience: "employee",
          employeeProfileId: bobId,
          kind: "trade",
          titleKey: "notificationShiftTradeDeclined",
          href: `/trades/archive-${index}`,
        })
      }
    })
    await t.withIdentity(bobIdentity).mutation(api.trades.offer, {
      tradeId: trade._id,
      eventId: bobShiftId,
    })

    await t.withIdentity(aliceIdentity).mutation(api.trades.respondToOffer, {
      tradeId: trade._id,
      response: "decline",
      reason: "I cannot work the offered shift.",
    })

    const notifications = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_hubId_and_audience", (q) =>
          q.eq("hubId", hubId).eq("audience", "employee")
        )
        .filter((q) => q.eq(q.field("shiftTradeId"), trade._id))
        .collect()
    )
    expect(notifications).toEqual([
      expect.objectContaining({
        employeeProfileId: bobId,
        titleKey: "notificationShiftTradeDeclined",
      }),
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
    const relatedNotifications = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("shiftTradeId"), tradeId))
        .collect()
    )
    expect(relatedNotifications).toHaveLength(2)
    expect(
      relatedNotifications.every(
        (notification) =>
          notification.audience === "employee" &&
          notification.titleKey === "notificationManagerDeclinedTrade"
      )
    ).toBe(true)
    const auditLogs = await t
      .withIdentity(ownerIdentity)
      .query(api.auditLogs.list, {
        hubId,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    expect(
      auditLogs.page
        .filter((log) => log.entityId === tradeId)
        .map((log) => log.action)
    ).toEqual([
      "tradeDeclined",
      "tradeOfferAccepted",
      "tradeOffered",
      "created",
    ])
  })

  test("paginates active employee trades without terminal-history gaps", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceId, bobId, aliceShiftId } = await setup(t)
    await t.withIdentity(ownerIdentity).mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    await t.run((ctx) =>
      ctx.db.patch("employeeProfiles", bobId, { accessLevel: "viewer" })
    )
    const activeSlug = await t
      .withIdentity(aliceIdentity)
      .mutation(api.trades.create, {
        hubId,
        sourceEventId: aliceShiftId,
        reason: "This active trade must remain on the first employee page.",
      })
    await t.run(async (ctx) => {
      for (let index = 0; index < 200; index += 1) {
        await ctx.db.insert("shiftTrades", {
          hubId,
          slug: `resolved-history-${index}`,
          publisherId: aliceId,
          sourceEventId: aliceShiftId,
          reason: "Resolved history",
          status: "unpublished",
          createdAt: index + 1,
          updatedAt: Date.now() + index + 1,
        })
      }
    })

    const trades = await t.withIdentity(bobIdentity).query(api.trades.list, {
      hubId,
      paginationOpts: { cursor: null, numItems: 50 },
    })
    expect(trades.page.map((trade) => trade.slug)).toEqual([activeSlug])
    expect(trades.isDone).toBe(true)
  })

  test("records edits, offer decisions, and cancellations in trade history", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceShiftId, bobShiftId } = await setup(t)
    await t.withIdentity(ownerIdentity).mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    const slug = await t
      .withIdentity(aliceIdentity)
      .mutation(api.trades.create, {
        hubId,
        sourceEventId: aliceShiftId,
        reason: "Initial reason",
      })
    const trade = await t.withIdentity(ownerIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    if (!trade) throw new Error("Missing trade")
    await t.withIdentity(aliceIdentity).mutation(api.trades.edit, {
      tradeId: trade.id,
      sourceEventId: aliceShiftId,
      reason: "Updated reason",
    })
    await t.withIdentity(bobIdentity).mutation(api.trades.offer, {
      tradeId: trade.id,
      eventId: bobShiftId,
    })
    await t.withIdentity(bobIdentity).mutation(api.trades.cancelOffer, {
      tradeId: trade.id,
    })
    await t.withIdentity(bobIdentity).mutation(api.trades.offer, {
      tradeId: trade.id,
      eventId: bobShiftId,
    })
    await t.withIdentity(aliceIdentity).mutation(api.trades.respondToOffer, {
      tradeId: trade.id,
      response: "decline",
      reason: "The offered shift does not work.",
    })
    await t.withIdentity(bobIdentity).mutation(api.trades.offer, {
      tradeId: trade.id,
      eventId: bobShiftId,
    })
    await t.withIdentity(ownerIdentity).mutation(api.trades.managerCancel, {
      tradeId: trade.id,
    })

    const auditLogs = await t
      .withIdentity(ownerIdentity)
      .query(api.auditLogs.list, {
        hubId,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    expect(
      auditLogs.page
        .filter((log) => log.entityId === trade.id)
        .map((log) => log.action)
    ).toEqual([
      "tradeCancelled",
      "tradeOffered",
      "tradeOfferDeclined",
      "tradeOffered",
      "tradeOfferCancelled",
      "tradeOffered",
      "edited",
      "created",
    ])
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
      paginationOpts: { numItems: 50, cursor: null },
    })
    const aliceTrade = trades.page.find(
      (trade) => trade.publisherName === "Alice Worker"
    )
    const bobTrade = trades.page.find((trade) => trade.slug === bobTradeSlug)
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

  test("allows viewer and editor employees to trade when enabled", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceId, bobId } = setupResult
    await t.run(async (ctx) => {
      await Promise.all([
        ctx.db.patch("employeeProfiles", aliceId, { accessLevel: "viewer" }),
        ctx.db.patch("employeeProfiles", bobId, { accessLevel: "editor" }),
      ])
    })

    const { slug } = await confirmedTrade(t, setupResult)
    await expect(
      t.withIdentity(aliceIdentity).query(api.trades.canPublish, { hubId })
    ).resolves.toBe(true)
    await expect(
      t.withIdentity(bobIdentity).query(api.trades.canPublish, { hubId })
    ).resolves.toBe(true)
    await expect(
      t.withIdentity(aliceIdentity).query(api.trades.get, { hubId, slug })
    ).resolves.toMatchObject({ status: "confirmed", viewerRole: "publisher" })
  })

  test("lists legacy assignments immediately and backfills them", async () => {
    vi.useFakeTimers()
    const t = convexTest(schema, modules)
    const { hubId, aliceId } = await setup(t)
    await t.withIdentity(ownerIdentity).mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    const futureEventId = await t.run(async (ctx) => {
      const category = await ctx.db
        .query("categories")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", "deputy-schedules")
        )
        .unique()
      if (!category) throw new Error("Missing schedule category")
      const existingAssignments = await ctx.db
        .query("eventEmployees")
        .withIndex("by_employeeProfileId_and_eventId", (q) =>
          q.eq("employeeProfileId", aliceId)
        )
        .take(20)
      for (const assignment of existingAssignments) {
        await ctx.db.delete("eventEmployees", assignment._id)
      }
      for (let index = 0; index < 1_001; index += 1) {
        const start = new Date(Date.UTC(2020, 0, 1 + index, 8))
        const end = new Date(start.getTime() + 8 * 60 * 60 * 1000)
        const eventId = await ctx.db.insert("events", {
          hubId,
          slug: `historical-alice-shift-${index}`,
          title: "Alice Worker",
          description: "Historical Deputy shift",
          categoryId: category._id,
          start: start.toISOString().slice(0, 16),
          end: end.toISOString().slice(0, 16),
          startUtc: start.toISOString(),
          endUtc: end.toISOString(),
          location: "Kitchen",
          notes: "",
          published: true,
          source: "deputy",
          externalId: `historical-${index}`,
          sourceEmployeeId: "11",
          sourceAreaId: "3",
          sourceDeleted: false,
        })
        await ctx.db.insert("eventEmployees", {
          hubId,
          eventId,
          employeeProfileId: aliceId,
          addedAt: index,
          addedBy: "test",
        })
      }
      const eventId = await ctx.db.insert("events", {
        hubId,
        slug: "future-alice-shift-after-history",
        title: "Alice Worker",
        description: "Future Deputy shift",
        categoryId: category._id,
        start: "2040-01-01T08:00",
        end: "2040-01-01T16:00",
        startUtc: "2040-01-01T06:00:00.000Z",
        endUtc: "2040-01-01T14:00:00.000Z",
        location: "Kitchen",
        notes: "",
        published: true,
        source: "deputy",
        externalId: "future-after-history",
        sourceEmployeeId: "11",
        sourceAreaId: "3",
        sourceDeleted: false,
      })
      await ctx.db.insert("eventEmployees", {
        hubId,
        eventId,
        employeeProfileId: aliceId,
        addedAt: 1_001,
        addedBy: "test",
      })
      return eventId
    })

    const shiftsBeforeBackfill = await t
      .withIdentity(aliceIdentity)
      .query(api.trades.listMyShifts, {
        hubId,
        now: Date.parse("2035-01-01T00:00:00.000Z"),
      })
    expect(shiftsBeforeBackfill.map((shift) => shift.eventId)).toEqual([
      futureEventId,
    ])

    await t.mutation(internal.trades.backfillEventAssignmentStartUtc, {
      paginationOpts: { numItems: 100, cursor: null },
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const legacyAssignments = await t.run((ctx) =>
      ctx.db
        .query("eventEmployees")
        .withIndex("by_employeeProfileId_and_eventId", (q) =>
          q.eq("employeeProfileId", aliceId)
        )
        .take(300)
        .then((assignments) =>
          assignments.filter(
            (assignment) => assignment.eventStartUtc === undefined
          )
        )
    )
    expect(legacyAssignments).toEqual([])

    const shifts = await t
      .withIdentity(aliceIdentity)
      .query(api.trades.listMyShifts, {
        hubId,
        now: Date.parse("2035-01-01T00:00:00.000Z"),
      })
    expect(shifts.map((shift) => shift.eventId)).toEqual([futureEventId])
  })

  test("does not expose employee trade notifications to public guests", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceShiftId } = await setup(t)
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

    const memberFeed = await t
      .withIdentity(bobIdentity)
      .query(api.notifications.listEmployee, { hubSlug: "trade-workplace" })
    expect(memberFeed.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "trade",
          messageValues: { name: "Alice Worker" },
        }),
      ])
    )
    const guestFeed = await t.query(api.notifications.listEmployee, {
      hubSlug: "trade-workplace",
      guestDeviceId: "public-guest-device-00000001",
    })
    expect(guestFeed.notifications.some((item) => item.kind === "trade")).toBe(
      false
    )
    expect(JSON.stringify(guestFeed)).not.toContain("Alice Worker")
  })

  test("rejects approval by either manager participating in the trade", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { tradeId } = await confirmedTrade(t, setupResult)

    await expect(
      t
        .withIdentity(aliceIdentity)
        .action(api.tradeApproval.approve, { tradeId })
    ).rejects.toThrow("tradeParticipantCannotApprove")
    await expect(
      t.withIdentity(bobIdentity).action(api.tradeApproval.approve, { tradeId })
    ).rejects.toThrow("tradeParticipantCannotApprove")
  })

  test("rejects approval through a newer active profile when an old linked profile participates", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceId } = setupResult
    const { tradeId } = await confirmedTrade(t, setupResult)
    await t.run(async (ctx) => {
      await ctx.db.patch("employeeProfiles", aliceId, {
        status: "deactivated",
      })
      await ctx.db.insert("employeeProfiles", {
        hubId,
        clerkUserId: aliceIdentity.subject,
        displayName: "Alice Worker (current)",
        status: "active",
        accessLevel: "manager",
        createdBy: "test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        invitationStatus: "accepted",
      })
    })

    await expect(
      t
        .withIdentity(aliceIdentity)
        .mutation(internal.trades.beginApproval, { tradeId })
    ).rejects.toThrow("tradeParticipantCannotApprove")
  })

  test("reserves deactivation before Clerk changes and blocks approval races", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { aliceId } = setupResult
    const { tradeId } = await confirmedTrade(t, setupResult)
    const owner = t.withIdentity(ownerIdentity)
    const { operationId } = await owner.mutation(
      api.employees.prepareClerkRemoval,
      { profileId: aliceId, action: "deactivate" }
    )

    await expect(
      owner.mutation(internal.trades.beginApproval, { tradeId })
    ).rejects.toThrow("tradeShiftNotAvailable")

    await owner.mutation(api.employees.abortClerkRemoval, {
      profileId: aliceId,
      operationId,
    })
    await expect(
      owner.mutation(internal.trades.beginApproval, { tradeId })
    ).resolves.toMatchObject({ resuming: false })
  })

  test("locks an approval attempt until it finishes or its lease expires", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { tradeId } = await confirmedTrade(t, setupResult)
    const owner = t.withIdentity(ownerIdentity)

    const approval = await owner.mutation(internal.trades.beginApproval, {
      tradeId,
    })
    expect(approval.attemptId).toBeTruthy()
    await expect(
      owner.mutation(internal.trades.beginApproval, { tradeId })
    ).rejects.toThrow("tradeApprovalInProgress")
    await t.run((ctx) =>
      ctx.db.patch("shiftTrades", tradeId, { approvalStartedAt: 0 })
    )
    const resumed = await owner.mutation(internal.trades.beginApproval, {
      tradeId,
    })
    expect(resumed).toMatchObject({ resuming: true })
    expect(resumed.attemptId).not.toBe(approval.attemptId)
    await expect(
      owner.mutation(internal.trades.finishApproval, {
        tradeId,
        attemptId: approval.attemptId,
        auditActor: approval.auditActor,
      })
    ).rejects.toThrow("tradeNotReadyForManager")
    await owner.mutation(internal.trades.failApproval, {
      tradeId,
      attemptId: approval.attemptId,
      message: "deputyShiftTradeUpdateFailed",
      keepProcessing: false,
    })
    await expect(
      t.run((ctx) => ctx.db.get("shiftTrades", tradeId))
    ).resolves.toMatchObject({
      status: "processing",
      approvalAttemptId: resumed.attemptId,
    })
  })

  test("applies an approved trade to both synchronized schedules", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceId, bobId, aliceShiftId, bobShiftId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    const attemptId = "approval-test-attempt"
    await t.run(async (ctx) => {
      await ctx.db.patch("shiftTrades", tradeId, {
        status: "processing",
        approvalAttemptId: attemptId,
        approvalStartedAt: Date.now(),
      })
    })
    await t
      .withIdentity(ownerIdentity)
      .mutation(internal.trades.finishApproval, {
        tradeId,
        attemptId,
        auditActor: {
          actorId: ownerIdentity.tokenIdentifier,
          actorSubject: ownerIdentity.subject,
          actorName: "Test owner",
        },
      })

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
    const relatedNotifications = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .filter((q) => q.eq(q.field("shiftTradeId"), tradeId))
        .collect()
    )
    expect(relatedNotifications).toHaveLength(2)
    expect(
      relatedNotifications.every(
        (notification) =>
          notification.audience === "employee" &&
          notification.titleKey === "notificationShiftTradeApproved"
      )
    ).toBe(true)
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
        intConfirmStatus: 0,
      }),
      expect.objectContaining({
        intRosterId: 102,
        intRosterEmployee: 11,
        intMealbreakMinute: 45,
        intConfirmStatus: 0,
      }),
    ])
    const approved = await t.withIdentity(ownerIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    expect(approved?.status).toBe("approved")
    const auditLogs = await t
      .withIdentity(ownerIdentity)
      .query(api.auditLogs.list, {
        hubId,
        paginationOpts: { cursor: null, numItems: 20 },
      })
    expect(
      auditLogs.page.find(
        (log) => log.entityId === tradeId && log.action === "tradeApproved"
      )
    ).toMatchObject({
      actorId: ownerIdentity.tokenIdentifier,
      actorSubject: ownerIdentity.subject,
      entityType: "shiftTrade",
    })
    const connection = await t.run((ctx) =>
      ctx.db.get("deputyConnections", connectionId)
    )
    expect(connection).toMatchObject({ status: "syncing" })
    expect(connection?.activeSyncId).toBeTruthy()
  })

  test("restores a partially applied Deputy trade back to manager review", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    let sourceEmployee = 11
    let targetEmployee = 12
    let rejectTarget = true
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input)
        if (url.endsWith("/Roster/101")) {
          return Response.json({
            Id: 101,
            Employee: sourceEmployee,
            StartTime: 1915682400,
            EndTime: 1915711200,
            OperationalUnit: 3,
            Published: true,
          })
        }
        if (url.endsWith("/Roster/102")) {
          return Response.json({
            Id: 102,
            Employee: targetEmployee,
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
          const payload = JSON.parse(String(init.body)) as {
            intRosterId: number
            intRosterEmployee: number
          }
          if (payload.intRosterId === 102 && rejectTarget) {
            return new Response(null, { status: 409 })
          }
          if (payload.intRosterId === 101)
            sourceEmployee = payload.intRosterEmployee
          if (payload.intRosterId === 102)
            targetEmployee = payload.intRosterEmployee
          return new Response(null, { status: 200 })
        }
        return new Response(null, { status: 404 })
      })
    try {
      await expect(
        t
          .withIdentity(ownerIdentity)
          .action(api.tradeApproval.approve, { tradeId })
      ).rejects.toThrow("deputyTargetRosterUpdateFailed")
      await expect(
        t.withIdentity(ownerIdentity).query(api.trades.get, { hubId, slug })
      ).resolves.toMatchObject({ status: "processing" })

      rejectTarget = false
      await t
        .withIdentity(ownerIdentity)
        .action(api.tradeApproval.rollback, { tradeId })
      await expect(
        t.withIdentity(ownerIdentity).query(api.trades.get, { hubId, slug })
      ).resolves.toMatchObject({ status: "confirmed" })
      expect(sourceEmployee).toBe(11)
      expect(targetEmployee).toBe(12)
      const auditLogs = await t
        .withIdentity(ownerIdentity)
        .query(api.auditLogs.list, {
          hubId,
          paginationOpts: { cursor: null, numItems: 20 },
        })
      expect(
        auditLogs.page.find(
          (log) => log.entityId === tradeId && log.action === "tradeRolledBack"
        )
      ).toMatchObject({
        actorId: ownerIdentity.tokenIdentifier,
        actorSubject: ownerIdentity.subject,
      })
    } finally {
      fetchMock.mockRestore()
    }
  })

  test("returns to manager review when Deputy rejects the first roster update", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
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
        if (
          url.endsWith("/api/v1/supervise/roster") &&
          init?.method === "POST"
        ) {
          return new Response(null, { status: 409 })
        }
        return new Response(null, { status: 404 })
      })
    try {
      await expect(
        t
          .withIdentity(ownerIdentity)
          .action(api.tradeApproval.approve, { tradeId })
      ).rejects.toThrow("deputySourceRosterUpdateFailed")
    } finally {
      fetchMock.mockRestore()
    }
    await expect(
      t.withIdentity(ownerIdentity).query(api.trades.get, { hubId, slug })
    ).resolves.toMatchObject({
      status: "confirmed",
      deputyError: "deputySourceRosterUpdateFailed",
    })
  })

  test("keeps an approval locked when the first Deputy write has an ambiguous network failure", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
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
        if (
          url.endsWith("/api/v1/supervise/roster") &&
          init?.method === "POST"
        ) {
          throw new Error("socketClosedAfterRequest")
        }
        return new Response(null, { status: 404 })
      })
    try {
      await expect(
        t
          .withIdentity(ownerIdentity)
          .action(api.tradeApproval.approve, { tradeId })
      ).rejects.toThrow("deputyShiftTradeUpdateFailed")
    } finally {
      fetchMock.mockRestore()
    }
    await expect(
      t.withIdentity(ownerIdentity).query(api.trades.get, { hubId, slug })
    ).resolves.toMatchObject({
      status: "processing",
      deputyError: "deputyShiftTradeUpdateFailed",
    })
  })

  test("keeps a resumed partial Deputy swap locked when the remaining update fails", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    await t.run((ctx) =>
      ctx.db.patch("shiftTrades", tradeId, {
        status: "processing",
        approvalStartedAt: 0,
        approvalOperation: "approve",
      })
    )
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
            Employee: 12,
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
          return new Response(null, { status: 409 })
        }
        return new Response(null, { status: 404 })
      })
    try {
      await expect(
        t
          .withIdentity(ownerIdentity)
          .action(api.tradeApproval.approve, { tradeId })
      ).rejects.toThrow("deputyTargetRosterUpdateFailed")
    } finally {
      fetchMock.mockRestore()
    }
    await expect(
      t.withIdentity(ownerIdentity).query(api.trades.get, { hubId, slug })
    ).resolves.toMatchObject({
      status: "processing",
      deputyError: "deputyTargetRosterUpdateFailed",
    })
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

  test("reconciles a legacy processing trade with an inactive participant", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    await t.run(async (ctx) => {
      await ctx.db.patch("shiftTrades", tradeId, { status: "processing" })
      await ctx.db.patch("employeeProfiles", aliceId, {
        status: "deactivated",
      })
    })
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
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
        return new Response(null, { status: 200 })
      })
    try {
      await t
        .withIdentity(ownerIdentity)
        .action(api.tradeApproval.approve, { tradeId })
    } finally {
      fetchMock.mockRestore()
    }

    await expect(
      t.withIdentity(ownerIdentity).query(api.trades.get, { hubId, slug })
    ).resolves.toMatchObject({ status: "approved" })
  })

  test("prevents employee removal while an active trade references the profile", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { aliceId } = setupResult
    await confirmedTrade(t, setupResult)

    await expect(
      t
        .withIdentity(ownerIdentity)
        .mutation(api.employees.prepareClerkRemoval, {
          profileId: aliceId,
          action: "remove",
        })
    ).rejects.toThrow("employeeHasShiftTrades")
  })

  test("allows employee removal after all referenced trades are historical", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { aliceId, bobId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)
    const owner = t.withIdentity(ownerIdentity)
    await owner.mutation(api.trades.managerDecline, {
      tradeId,
      reason: "This trade is complete history.",
    })
    await t.run(async (ctx) => {
      for (let index = 0; index < 150; index += 1) {
        await ctx.db.insert("notifications", {
          hubId: setupResult.hubId,
          audience: "trade-managers",
          kind: "trade",
          titleKey: "notificationShiftTradeNeedsApproval",
          href: `/trades/unrelated-${index}`,
        })
      }
      for (let index = 0; index < 500; index += 1) {
        await ctx.db.insert("deputyEmployeeMappings", {
          hubId: setupResult.hubId,
          deputyEmployeeId: `0${index.toString().padStart(4, "0")}`,
          employeeProfileId: bobId,
        })
      }
      await ctx.db.insert("notifications", {
        hubId: setupResult.hubId,
        audience: "trade-managers",
        kind: "trade",
        titleKey: "notificationShiftTradeNeedsApproval",
        href: `/trades/${slug}`,
      })
    })

    await expect(
      owner.query(api.employees.getForAdmin, { profileId: aliceId })
    ).resolves.toMatchObject({ hasShiftTrades: false })
    const { operationId } = await owner.mutation(
      api.employees.prepareClerkRemoval,
      { profileId: aliceId, action: "remove" }
    )
    let removed = false
    for (let attempt = 0; attempt < 5 && !removed; attempt += 1) {
      ;({ removed } = await owner.mutation(api.employees.removeProfileBatch, {
        profileId: aliceId,
        operationId,
      }))
    }
    expect(removed).toBe(true)
    await expect(
      t.run((ctx) => ctx.db.get("employeeProfiles", aliceId))
    ).resolves.toBeNull()
    await expect(
      t.run((ctx) => ctx.db.get("shiftTrades", tradeId))
    ).resolves.toBeNull()
    const danglingRecords = await t.run(async (ctx) => {
      const notificationGroups = await Promise.all(
        [
          "trade-employees",
          "trade-managers",
          "employee",
          "employees",
          "managers",
        ].map((audience) =>
          ctx.db
            .query("notifications")
            .withIndex("by_hubId_and_audience", (q) =>
              q.eq("hubId", setupResult.hubId).eq("audience", audience as never)
            )
            .take(20)
        )
      )
      return {
        notifications: notificationGroups
          .flat()
          .filter(
            (notification) =>
              notification.shiftTradeId === tradeId ||
              notification.href === `/trades/${slug}`
          ),
        deputyMappings: await ctx.db
          .query("deputyEmployeeMappings")
          .withIndex("by_hubId_and_deputyEmployeeId", (q) =>
            q.eq("hubId", setupResult.hubId)
          )
          .filter((q) => q.eq(q.field("employeeProfileId"), aliceId))
          .take(10),
      }
    })
    expect(danglingRecords).toEqual({ notifications: [], deputyMappings: [] })
  })

  test("unpublishes active trades when a participant is deactivated", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceId } = setupResult
    const { tradeId, slug } = await confirmedTrade(t, setupResult)

    const owner = t.withIdentity(ownerIdentity)
    const { operationId } = await owner.mutation(
      api.employees.prepareClerkRemoval,
      { profileId: aliceId, action: "deactivate" }
    )
    await owner.mutation(api.employees.deactivateAfterClerkRemoval, {
      profileId: aliceId,
      operationId,
    })

    await expect(
      t.withIdentity(ownerIdentity).query(api.trades.get, { hubId, slug })
    ).resolves.toMatchObject({ status: "unpublished" })
    await expect(
      t.run((ctx) =>
        ctx.db
          .query("notifications")
          .filter((q) => q.eq(q.field("shiftTradeId"), tradeId))
          .collect()
      )
    ).resolves.toEqual([])
  })

  test("refuses deactivation before bounded cleanup could leave active trades", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { hubId, aliceId, aliceShiftId } = setupResult
    await t.run(async (ctx) => {
      for (let index = 0; index < 501; index += 1) {
        await ctx.db.insert("shiftTrades", {
          hubId,
          slug: `overflow-trade-${index}`,
          publisherId: aliceId,
          sourceEventId: aliceShiftId,
          reason: "Overflow guard regression coverage",
          status: "published",
          createdAt: index,
          updatedAt: index,
        })
      }
    })

    await expect(
      t
        .withIdentity(ownerIdentity)
        .mutation(api.employees.prepareClerkRemoval, {
          profileId: aliceId,
          action: "deactivate",
        })
    ).rejects.toThrow("employeeHasTooManyActiveShiftTrades")
    await expect(
      t.run((ctx) => ctx.db.get("employeeProfiles", aliceId))
    ).resolves.toMatchObject({ status: "active" })
  })

  test("lets a manager cancel a published trade with an inactive publisher", async () => {
    const t = convexTest(schema, modules)
    const { hubId, aliceId, aliceShiftId } = await setup(t)
    const owner = t.withIdentity(ownerIdentity)
    await owner.mutation(api.hubs.setWorkersCanEdit, {
      hubId,
      section: "trades",
      enabled: true,
    })
    const slug = await t
      .withIdentity(aliceIdentity)
      .mutation(api.trades.create, {
        hubId,
        sourceEventId: aliceShiftId,
        reason: "This simulates a trade left behind before the fix.",
      })
    const trade = await t.withIdentity(aliceIdentity).query(api.trades.get, {
      hubId,
      slug,
    })
    if (!trade) throw new Error("Missing trade")
    await t.run((ctx) =>
      ctx.db.patch("employeeProfiles", aliceId, { status: "deactivated" })
    )

    await owner.mutation(api.trades.managerCancel, { tradeId: trade.id })
    await expect(
      owner.query(api.trades.get, { hubId, slug })
    ).resolves.toMatchObject({ status: "unpublished" })
  })

  test("blocks deactivation while a participant approval is processing", async () => {
    const t = convexTest(schema, modules)
    const setupResult = await setup(t)
    const { aliceId } = setupResult
    const { tradeId } = await confirmedTrade(t, setupResult)
    const owner = t.withIdentity(ownerIdentity)
    await owner.mutation(internal.trades.beginApproval, { tradeId })

    await expect(
      owner.mutation(api.employees.prepareClerkRemoval, {
        profileId: aliceId,
        action: "deactivate",
      })
    ).rejects.toThrow("employeeHasTradeApprovalInProgress")
    await expect(
      t.run(async (ctx) => ({
        profile: await ctx.db.get("employeeProfiles", aliceId),
        trade: await ctx.db.get("shiftTrades", tradeId),
      }))
    ).resolves.toMatchObject({
      profile: { status: "active" },
      trade: { status: "processing" },
    })
  })
})
