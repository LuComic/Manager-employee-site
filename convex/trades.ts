import { v } from "convex/values"

import { normalizeWorkersCanEdit } from "../lib/worker-editing"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { requireHubPermission } from "./lib/access"
import { decryptDeputyTokens } from "./lib/deputyCredentials"
import { createNotification } from "./lib/notifications"

const tradeStatusValidator = v.union(
  v.literal("published"),
  v.literal("offer-pending"),
  v.literal("confirmed"),
  v.literal("processing"),
  v.literal("approved"),
  v.literal("manager-declined"),
  v.literal("unpublished")
)

const shiftValidator = v.object({
  eventId: v.id("events"),
  employeeId: v.id("employeeProfiles"),
  employeeName: v.string(),
  start: v.string(),
  end: v.string(),
  area: v.string(),
})

const tradeValidator = v.object({
  id: v.id("shiftTrades"),
  slug: v.string(),
  reason: v.string(),
  status: tradeStatusValidator,
  publisherId: v.id("employeeProfiles"),
  publisherName: v.string(),
  sourceShift: shiftValidator,
  offeredShift: v.union(v.null(), shiftValidator),
  offeringEmployeeId: v.optional(v.id("employeeProfiles")),
  employeeDeclineReason: v.optional(v.string()),
  managerDeclineReason: v.optional(v.string()),
  deputyError: v.optional(v.string()),
  canManage: v.boolean(),
  viewerRole: v.union(
    v.literal("publisher"),
    v.literal("offerer"),
    v.literal("manager"),
    v.literal("employee")
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})

type ReadCtx = QueryCtx | MutationCtx

const ACTIVE_TRADE_STATUSES = [
  "published",
  "offer-pending",
  "confirmed",
  "processing",
] as const satisfies readonly Doc<"shiftTrades">["status"][]

const APPROVAL_LEASE_MS = 15 * 60 * 1000

function cleanReason(value: string, errorKey = "tradeReasonRequired") {
  const reason = value.trim()
  if (!reason) throw new Error(errorKey)
  if (reason.length > 500) throw new Error("tradeReasonTooLong")
  return reason
}

async function accessForTrades(ctx: ReadCtx, hubId: Id<"hubs">) {
  const access = await requireHubPermission(ctx, hubId, "viewer")
  const profiles = await ctx.db
    .query("employeeProfiles")
    .withIndex("by_hubId_and_clerkUserId", (q) =>
      q.eq("hubId", hubId).eq("clerkUserId", access.identity.subject)
    )
    .take(10)
  const employee = profiles.find((profile) => profile.status === "active")
  return { ...access, employee }
}

function assertEmployeeTradeAccess(
  access: Awaited<ReturnType<typeof accessForTrades>>
) {
  if (
    !access.employee ||
    !normalizeWorkersCanEdit(access.hub.workersCanEdit).trades
  ) {
    throw new Error("tradesNotEnabled")
  }
}

async function assertOwnDeputyShift(
  ctx: ReadCtx,
  args: {
    hubId: Id<"hubs">
    employeeId: Id<"employeeProfiles">
    eventId: Id<"events">
    now: number
    allowInactiveEmployee?: boolean
  }
) {
  const [event, employee, assignment] = await Promise.all([
    ctx.db.get("events", args.eventId),
    ctx.db.get("employeeProfiles", args.employeeId),
    ctx.db
      .query("eventEmployees")
      .withIndex("by_eventId_and_employeeProfileId", (q) =>
        q.eq("eventId", args.eventId).eq("employeeProfileId", args.employeeId)
      )
      .unique(),
  ])
  if (
    !event ||
    !employee ||
    employee.hubId !== args.hubId ||
    (!args.allowInactiveEmployee && employee.status !== "active") ||
    event.hubId !== args.hubId ||
    event.source !== "deputy" ||
    !event.published ||
    event.sourceDeleted ||
    event.managerDeleted ||
    !assignment ||
    Date.parse(event.startUtc ?? event.start) <= args.now
  ) {
    throw new Error("tradeShiftNotAvailable")
  }
  return event
}

async function assertShiftNotInActiveTrade(
  ctx: ReadCtx,
  eventId: Id<"events">,
  excludedTradeId?: Id<"shiftTrades">
) {
  const conflicts = await Promise.all(
    ACTIVE_TRADE_STATUSES.flatMap((status) => [
      ctx.db
        .query("shiftTrades")
        .withIndex("by_sourceEventId_and_status", (q) =>
          q.eq("sourceEventId", eventId).eq("status", status)
        )
        .first(),
      ctx.db
        .query("shiftTrades")
        .withIndex("by_offeredEventId_and_status", (q) =>
          q.eq("offeredEventId", eventId).eq("status", status)
        )
        .first(),
    ])
  )
  if (conflicts.some((trade) => trade && trade._id !== excludedTradeId)) {
    throw new Error("tradeAlreadyPublishedForShift")
  }
}

function shiftSummary(
  events: Map<Id<"events">, Doc<"events">>,
  employees: Map<Id<"employeeProfiles">, Doc<"employeeProfiles">>,
  eventId: Id<"events">,
  employeeId: Id<"employeeProfiles">
) {
  const event = events.get(eventId)
  const employee = employees.get(employeeId)
  if (!event || !employee) return null
  return {
    eventId,
    employeeId,
    employeeName: employee.displayName,
    start: event.start,
    end: event.end,
    area: event.location,
  }
}

function tradeResult(
  trade: Doc<"shiftTrades">,
  access: Awaited<ReturnType<typeof accessForTrades>>,
  events: Map<Id<"events">, Doc<"events">>,
  employees: Map<Id<"employeeProfiles">, Doc<"employeeProfiles">>
) {
  const publisher = employees.get(trade.publisherId)
  const sourceShift = shiftSummary(
    events,
    employees,
    trade.sourceEventId,
    trade.publisherId
  )
  const offeredShift =
    trade.offeredEventId && trade.offeringEmployeeId
      ? shiftSummary(
          events,
          employees,
          trade.offeredEventId,
          trade.offeringEmployeeId
        )
      : null
  if (!publisher || !sourceShift) return null
  const manager =
    access.permission === "manager" || access.permission === "owner"
  const viewerRole =
    access.employee?._id === trade.publisherId
      ? ("publisher" as const)
      : access.employee?._id === trade.offeringEmployeeId
        ? ("offerer" as const)
        : access.employee &&
            (trade.status === "published" || trade.status === "offer-pending")
          ? ("employee" as const)
          : manager
            ? ("manager" as const)
            : ("employee" as const)
  return {
    id: trade._id,
    slug: trade.slug,
    reason: trade.reason,
    status: trade.status,
    publisherId: trade.publisherId,
    publisherName: publisher.displayName,
    sourceShift,
    offeredShift,
    offeringEmployeeId: trade.offeringEmployeeId,
    employeeDeclineReason: trade.employeeDeclineReason,
    managerDeclineReason: trade.managerDeclineReason,
    deputyError: trade.deputyError,
    canManage: manager,
    viewerRole,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
  }
}

async function tradeResults(
  ctx: ReadCtx,
  trades: Doc<"shiftTrades">[],
  access: Awaited<ReturnType<typeof accessForTrades>>
) {
  const employeeIds = new Set<Id<"employeeProfiles">>()
  const eventIds = new Set<Id<"events">>()
  for (const trade of trades) {
    employeeIds.add(trade.publisherId)
    eventIds.add(trade.sourceEventId)
    if (trade.offeringEmployeeId) employeeIds.add(trade.offeringEmployeeId)
    if (trade.offeredEventId) eventIds.add(trade.offeredEventId)
  }
  const [employeeEntries, eventEntries] = await Promise.all([
    Promise.all(
      [...employeeIds].map(
        async (id) => [id, await ctx.db.get("employeeProfiles", id)] as const
      )
    ),
    Promise.all(
      [...eventIds].map(
        async (id) => [id, await ctx.db.get("events", id)] as const
      )
    ),
  ])
  const employees = new Map(
    employeeEntries.filter(
      (
        entry
      ): entry is readonly [Id<"employeeProfiles">, Doc<"employeeProfiles">] =>
        entry[1] !== null
    )
  )
  const events = new Map(
    eventEntries.filter(
      (entry): entry is readonly [Id<"events">, Doc<"events">] =>
        entry[1] !== null
    )
  )
  return trades.flatMap((trade) => {
    const result = tradeResult(trade, access, events, employees)
    return result ? [result] : []
  })
}

export const list = query({
  args: { hubId: v.id("hubs") },
  returns: v.array(tradeValidator),
  handler: async (ctx, args) => {
    const access = await accessForTrades(ctx, args.hubId)
    const manager =
      access.permission === "manager" || access.permission === "owner"
    if (!manager) assertEmployeeTradeAccess(access)
    const trades = await ctx.db
      .query("shiftTrades")
      .withIndex("by_hubId_and_updatedAt", (q) => q.eq("hubId", args.hubId))
      .order("desc")
      .take(200)
    const visible = manager
      ? trades
      : trades.filter((trade) =>
          ACTIVE_TRADE_STATUSES.some((status) => status === trade.status)
        )
    return await tradeResults(ctx, visible, access)
  },
})

export const get = query({
  args: { hubId: v.id("hubs"), slug: v.string() },
  returns: v.union(v.null(), tradeValidator),
  handler: async (ctx, args) => {
    const access = await accessForTrades(ctx, args.hubId)
    const manager =
      access.permission === "manager" || access.permission === "owner"
    if (!manager) assertEmployeeTradeAccess(access)
    const trade = await ctx.db
      .query("shiftTrades")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!trade) return null
    if (
      trade.status === "unpublished" &&
      access.permission !== "manager" &&
      access.permission !== "owner"
    ) {
      return null
    }
    return (await tradeResults(ctx, [trade], access))[0] ?? null
  },
})

export const listMyShifts = query({
  args: { hubId: v.id("hubs"), now: v.number() },
  returns: v.array(shiftValidator),
  handler: async (ctx, args) => {
    const access = await accessForTrades(ctx, args.hubId)
    assertEmployeeTradeAccess(access)
    if (!access.employee) return []
    const [futureAssignments, legacyAssignments] = await Promise.all([
      ctx.db
        .query("eventEmployees")
        .withIndex("by_employeeProfileId_and_eventStartUtc", (q) =>
          q
            .eq("employeeProfileId", access.employee!._id)
            .gt("eventStartUtc", new Date(args.now).toISOString())
        )
        .order("asc")
        .take(200),
      ctx.db
        .query("eventEmployees")
        .withIndex("by_employeeProfileId_and_eventStartUtc", (q) =>
          q
            .eq("employeeProfileId", access.employee!._id)
            .eq("eventStartUtc", undefined)
        )
        .order("desc")
        .take(200),
    ])
    const assignments = [...futureAssignments, ...legacyAssignments]
    const assignedEvents = await Promise.all(
      assignments.map((assignment) => ctx.db.get("events", assignment.eventId))
    )
    const shifts = []
    for (const event of assignedEvents) {
      if (
        !event ||
        event.hubId !== args.hubId ||
        event.source !== "deputy" ||
        !event.published ||
        event.sourceDeleted ||
        event.managerDeleted ||
        Date.parse(event.startUtc ?? event.start) <= args.now
      ) {
        continue
      }
      shifts.push({
        eventId: event._id,
        employeeId: access.employee._id,
        employeeName: access.employee.displayName,
        start: event.start,
        end: event.end,
        area: event.location,
      })
    }
    return shifts.sort((a, b) => a.start.localeCompare(b.start)).slice(0, 200)
  },
})

export const canPublish = query({
  args: { hubId: v.id("hubs") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const access = await accessForTrades(ctx, args.hubId)
    return Boolean(
      access.employee &&
      normalizeWorkersCanEdit(access.hub.workersCanEdit).trades
    )
  },
})

export const create = mutation({
  args: {
    hubId: v.id("hubs"),
    sourceEventId: v.id("events"),
    reason: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const access = await accessForTrades(ctx, args.hubId)
    assertEmployeeTradeAccess(access)
    if (!access.employee) throw new Error("employeeProfileRequired")
    const event = await assertOwnDeputyShift(ctx, {
      hubId: args.hubId,
      employeeId: access.employee._id,
      eventId: args.sourceEventId,
      now: Date.now(),
    })
    await assertShiftNotInActiveTrade(ctx, args.sourceEventId)
    const now = Date.now()
    const slug = crypto.randomUUID()
    await ctx.db.insert("shiftTrades", {
      hubId: args.hubId,
      slug,
      publisherId: access.employee._id,
      sourceEventId: event._id,
      reason: cleanReason(args.reason),
      status: "published",
      createdAt: now,
      updatedAt: now,
    })
    await createNotification(ctx, {
      hubId: args.hubId,
      audience: "trade-employees",
      kind: "trade",
      titleKey: "notificationNewShiftTrade",
      messageKey: "notificationEmployeePublishedTrade",
      messageValues: { name: access.employee.displayName },
      href: `/trades/${slug}`,
    })
    return slug
  },
})

export const edit = mutation({
  args: {
    tradeId: v.id("shiftTrades"),
    sourceEventId: v.id("events"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) throw new Error("tradeNotFound")
    const access = await accessForTrades(ctx, trade.hubId)
    assertEmployeeTradeAccess(access)
    if (!access.employee || access.employee._id !== trade.publisherId) {
      throw new Error("unauthorized")
    }
    if (trade.status !== "published") throw new Error("tradeCannotBeEdited")
    await assertOwnDeputyShift(ctx, {
      hubId: trade.hubId,
      employeeId: access.employee._id,
      eventId: args.sourceEventId,
      now: Date.now(),
    })
    await assertShiftNotInActiveTrade(ctx, args.sourceEventId, trade._id)
    await ctx.db.patch("shiftTrades", trade._id, {
      sourceEventId: args.sourceEventId,
      reason: cleanReason(args.reason),
      employeeDeclineReason: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const unpublish = mutation({
  args: { tradeId: v.id("shiftTrades") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) return null
    const access = await accessForTrades(ctx, trade.hubId)
    assertEmployeeTradeAccess(access)
    if (!access.employee || access.employee._id !== trade.publisherId) {
      throw new Error("unauthorized")
    }
    if (trade.status === "approved" || trade.status === "processing") {
      throw new Error("tradeCannotBeUnpublished")
    }
    await ctx.db.patch("shiftTrades", trade._id, {
      status: "unpublished",
      updatedAt: Date.now(),
    })
    return null
  },
})

export const offer = mutation({
  args: { tradeId: v.id("shiftTrades"), eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) throw new Error("tradeNotFound")
    const access = await accessForTrades(ctx, trade.hubId)
    assertEmployeeTradeAccess(access)
    if (!access.employee) throw new Error("employeeProfileRequired")
    if (access.employee._id === trade.publisherId) {
      throw new Error("cannotOfferOwnTrade")
    }
    if (trade.status !== "published") throw new Error("tradeHasActiveOffer")
    await assertOwnDeputyShift(ctx, {
      hubId: trade.hubId,
      employeeId: access.employee._id,
      eventId: args.eventId,
      now: Date.now(),
    })
    if (args.eventId === trade.sourceEventId) throw new Error("tradeShiftSame")
    await assertShiftNotInActiveTrade(ctx, args.eventId, trade._id)
    await ctx.db.patch("shiftTrades", trade._id, {
      status: "offer-pending",
      offeringEmployeeId: access.employee._id,
      offeredEventId: args.eventId,
      employeeDeclineReason: undefined,
      managerDeclineReason: undefined,
      deputyError: undefined,
      updatedAt: Date.now(),
    })
    await createNotification(ctx, {
      hubId: trade.hubId,
      audience: "employee",
      employeeProfileId: trade.publisherId,
      kind: "trade",
      titleKey: "notificationShiftTradeOffer",
      messageKey: "notificationEmployeeOfferedShift",
      messageValues: { name: access.employee.displayName },
      href: `/trades/${trade.slug}`,
    })
    return null
  },
})

export const cancelOffer = mutation({
  args: { tradeId: v.id("shiftTrades") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) return null
    const access = await accessForTrades(ctx, trade.hubId)
    assertEmployeeTradeAccess(access)
    if (
      !access.employee ||
      access.employee._id !== trade.offeringEmployeeId ||
      trade.status !== "offer-pending"
    ) {
      throw new Error("unauthorized")
    }
    await ctx.db.patch("shiftTrades", trade._id, {
      status: "published",
      offeringEmployeeId: undefined,
      offeredEventId: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const respondToOffer = mutation({
  args: {
    tradeId: v.id("shiftTrades"),
    response: v.union(v.literal("accept"), v.literal("decline")),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) throw new Error("tradeNotFound")
    const access = await accessForTrades(ctx, trade.hubId)
    assertEmployeeTradeAccess(access)
    if (!access.employee || access.employee._id !== trade.publisherId) {
      throw new Error("unauthorized")
    }
    if (
      trade.status !== "offer-pending" ||
      !trade.offeringEmployeeId ||
      !trade.offeredEventId
    ) {
      throw new Error("tradeOfferNotAvailable")
    }
    if (args.response === "accept") {
      const offerer = await ctx.db.get(
        "employeeProfiles",
        trade.offeringEmployeeId
      )
      if (!offerer) throw new Error("employeeProfileRequired")
      await ctx.db.patch("shiftTrades", trade._id, {
        status: "confirmed",
        employeeDeclineReason: undefined,
        updatedAt: Date.now(),
      })
      await createNotification(ctx, {
        hubId: trade.hubId,
        audience: "trade-managers",
        kind: "trade",
        titleKey: "notificationShiftTradeNeedsApproval",
        messageKey: "notificationEmployeesWantTrade",
        messageValues: {
          first: access.employee.displayName,
          second: offerer.displayName,
        },
        href: `/trades/${trade.slug}`,
      })
    } else {
      const reason = cleanReason(
        args.reason ?? "",
        "tradeDeclineReasonRequired"
      )
      await ctx.db.patch("shiftTrades", trade._id, {
        status: "published",
        offeringEmployeeId: undefined,
        offeredEventId: undefined,
        employeeDeclineReason: reason,
        updatedAt: Date.now(),
      })
      await createNotification(ctx, {
        hubId: trade.hubId,
        audience: "employee",
        employeeProfileId: trade.offeringEmployeeId,
        kind: "trade",
        titleKey: "notificationShiftTradeDeclined",
        message: reason,
        href: `/trades/${trade.slug}`,
      })
    }
    return null
  },
})

export const managerDecline = mutation({
  args: { tradeId: v.id("shiftTrades"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) throw new Error("tradeNotFound")
    await requireHubPermission(ctx, trade.hubId, "manager")
    if (trade.status !== "confirmed" || !trade.offeringEmployeeId) {
      throw new Error("tradeNotReadyForManager")
    }
    const reason = cleanReason(args.reason, "tradeDeclineReasonRequired")
    await ctx.db.patch("shiftTrades", trade._id, {
      status: "manager-declined",
      managerDeclineReason: reason,
      updatedAt: Date.now(),
    })
    for (const employeeProfileId of [
      trade.publisherId,
      trade.offeringEmployeeId,
    ]) {
      await createNotification(ctx, {
        hubId: trade.hubId,
        audience: "employee",
        employeeProfileId,
        kind: "trade",
        titleKey: "notificationManagerDeclinedTrade",
        message: reason,
        href: `/trades/${trade.slug}`,
      })
    }
    return null
  },
})

export const managerCancel = mutation({
  args: { tradeId: v.id("shiftTrades") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) return null
    await requireHubPermission(ctx, trade.hubId, "manager")
    if (trade.status !== "published" && trade.status !== "offer-pending") {
      throw new Error("tradeCannotBeUnpublished")
    }
    await ctx.db.patch("shiftTrades", trade._id, {
      status: "unpublished",
      updatedAt: Date.now(),
    })
    return null
  },
})

export const beginApproval = internalMutation({
  args: { tradeId: v.id("shiftTrades") },
  returns: v.object({
    connectionId: v.id("deputyConnections"),
    tokenVersion: v.number(),
    endpoint: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    accessTokenExpiresAt: v.number(),
    attemptId: v.string(),
    resuming: v.boolean(),
    source: v.object({
      rosterId: v.string(),
      employeeId: v.string(),
      startUtc: v.string(),
      endUtc: v.string(),
      areaId: v.string(),
      published: v.boolean(),
    }),
    target: v.object({
      rosterId: v.string(),
      employeeId: v.string(),
      startUtc: v.string(),
      endUtc: v.string(),
      areaId: v.string(),
      published: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (!trade) throw new Error("tradeNotFound")
    const { identity } = await requireHubPermission(ctx, trade.hubId, "manager")
    if (
      (trade.status !== "confirmed" && trade.status !== "processing") ||
      !trade.offeredEventId ||
      !trade.offeringEmployeeId
    ) {
      throw new Error("tradeNotReadyForManager")
    }
    const now = Date.now()
    const resuming = trade.status === "processing"
    if (
      trade.status === "processing" &&
      trade.approvalAttemptId &&
      (trade.approvalStartedAt ?? now) > now - APPROVAL_LEASE_MS
    ) {
      throw new Error("tradeApprovalInProgress")
    }
    const approverProfiles = await ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_clerkUserId", (q) =>
        q.eq("hubId", trade.hubId).eq("clerkUserId", identity.subject)
      )
      .take(10)
    const approverIsParticipant = approverProfiles.some(
      (profile) =>
        profile.status === "active" &&
        (profile._id === trade.publisherId ||
          profile._id === trade.offeringEmployeeId)
    )
    if (approverIsParticipant) {
      throw new Error("tradeParticipantCannotApprove")
    }
    const attemptId = crypto.randomUUID()
    const [connection, source, target] = await Promise.all([
      ctx.db
        .query("deputyConnections")
        .withIndex("by_hubId", (q) => q.eq("hubId", trade.hubId))
        .unique(),
      assertOwnDeputyShift(ctx, {
        hubId: trade.hubId,
        employeeId: trade.publisherId,
        eventId: trade.sourceEventId,
        now,
        allowInactiveEmployee: resuming,
      }),
      assertOwnDeputyShift(ctx, {
        hubId: trade.hubId,
        employeeId: trade.offeringEmployeeId,
        eventId: trade.offeredEventId,
        now,
        allowInactiveEmployee: resuming,
      }),
    ])
    if (!connection) throw new Error("deputyNotConnected")
    const shiftPayload = (event: typeof source) => {
      if (
        !event ||
        event.source !== "deputy" ||
        !event.externalId ||
        !event.sourceEmployeeId ||
        !event.sourceAreaId ||
        !event.startUtc ||
        !event.endUtc
      ) {
        throw new Error("tradeShiftNotAvailable")
      }
      return {
        rosterId: event.externalId,
        employeeId: event.sourceEmployeeId,
        startUtc: event.startUtc,
        endUtc: event.endUtc,
        areaId: event.sourceAreaId,
        published: event.published,
      }
    }
    const tokens = await decryptDeputyTokens(connection)
    await ctx.db.patch("shiftTrades", trade._id, {
      status: "processing",
      deputyError: undefined,
      approvalAttemptId: attemptId,
      approvalStartedAt: now,
      updatedAt: Date.now(),
    })
    return {
      connectionId: connection._id,
      tokenVersion: connection.tokenVersion,
      endpoint: connection.endpoint,
      ...tokens,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      attemptId,
      resuming,
      source: shiftPayload(source),
      target: shiftPayload(target),
    }
  },
})

async function replaceEventEmployee(
  ctx: MutationCtx,
  eventId: Id<"events">,
  employeeId: Id<"employeeProfiles">,
  deputyEmployeeId: string
) {
  const employee = await ctx.db.get("employeeProfiles", employeeId)
  const event = await ctx.db.get("events", eventId)
  if (!employee || !event) throw new Error("tradeShiftNotAvailable")
  const assignments = await ctx.db
    .query("eventEmployees")
    .withIndex("by_eventId_and_employeeProfileId", (q) =>
      q.eq("eventId", eventId)
    )
    .take(20)
  for (const assignment of assignments) {
    await ctx.db.delete("eventEmployees", assignment._id)
  }
  await ctx.db.insert("eventEmployees", {
    hubId: event.hubId,
    eventId,
    employeeProfileId: employeeId,
    ...(event.startUtc ? { eventStartUtc: event.startUtc } : {}),
    addedAt: Date.now(),
    addedBy: "deputy-trade",
  })
  await ctx.db.patch("events", eventId, {
    title: employee.displayName,
    sourceEmployeeId: deputyEmployeeId,
  })
}

export const finishApproval = internalMutation({
  args: { tradeId: v.id("shiftTrades"), attemptId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (
      !trade ||
      trade.status !== "processing" ||
      trade.approvalAttemptId !== args.attemptId ||
      !trade.offeredEventId ||
      !trade.offeringEmployeeId
    ) {
      throw new Error("tradeNotReadyForManager")
    }
    const [source, target] = await Promise.all([
      ctx.db.get("events", trade.sourceEventId),
      ctx.db.get("events", trade.offeredEventId),
    ])
    if (!source?.sourceEmployeeId || !target?.sourceEmployeeId) {
      throw new Error("tradeShiftNotAvailable")
    }
    await replaceEventEmployee(
      ctx,
      source._id,
      trade.offeringEmployeeId,
      target.sourceEmployeeId
    )
    await replaceEventEmployee(
      ctx,
      target._id,
      trade.publisherId,
      source.sourceEmployeeId
    )
    await ctx.db.patch("shiftTrades", trade._id, {
      status: "approved",
      deputyError: undefined,
      approvalAttemptId: undefined,
      approvalStartedAt: undefined,
      updatedAt: Date.now(),
    })
    for (const employeeProfileId of [
      trade.publisherId,
      trade.offeringEmployeeId,
    ]) {
      await createNotification(ctx, {
        hubId: trade.hubId,
        audience: "employee",
        employeeProfileId,
        kind: "trade",
        titleKey: "notificationShiftTradeApproved",
        messageKey: "notificationSchedulesUpdatedInDeputy",
        href: `/trades/${trade.slug}`,
      })
    }
    return null
  },
})

export const failApproval = internalMutation({
  args: {
    tradeId: v.id("shiftTrades"),
    attemptId: v.string(),
    message: v.string(),
    keepProcessing: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const trade = await ctx.db.get("shiftTrades", args.tradeId)
    if (
      !trade ||
      trade.status !== "processing" ||
      trade.approvalAttemptId !== args.attemptId
    ) {
      return null
    }
    await ctx.db.patch("shiftTrades", trade._id, {
      status: args.keepProcessing ? "processing" : "confirmed",
      deputyError: args.message.slice(0, 300),
      approvalAttemptId: undefined,
      approvalStartedAt: undefined,
      updatedAt: Date.now(),
    })
    return null
  },
})
