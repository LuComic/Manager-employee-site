import { v } from "convex/values"

import { DEPUTY_SCHEDULES_EVENT_TYPE_ID } from "../lib/categories"
import { normalizeDeputyEndpoint } from "../lib/deputy"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server"
import { requireHubPermission } from "./lib/access"
import {
  decryptDeputyTokens,
  encryptDeputyTokens,
} from "./lib/deputyCredentials"

const rosterValidator = v.object({
  externalId: v.string(),
  startUtc: v.string(),
  endUtc: v.string(),
  employeeId: v.string(),
  employeeName: v.string(),
  areaId: v.string(),
  areaName: v.string(),
  published: v.boolean(),
})

function wallTime(value: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

async function deputyCategory(ctx: MutationCtx, hubId: Id<"hubs">) {
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_hubId_and_slug", (q) =>
      q.eq("hubId", hubId).eq("slug", DEPUTY_SCHEDULES_EVENT_TYPE_ID)
    )
    .unique()
  if (existing) return existing
  const last = await ctx.db
    .query("categories")
    .withIndex("by_hubId_and_kind_and_order", (q) =>
      q.eq("hubId", hubId).eq("kind", "event")
    )
    .order("desc")
    .first()
  const id = await ctx.db.insert("categories", {
    hubId,
    slug: DEPUTY_SCHEDULES_EVENT_TYPE_ID,
    label: "Schedules",
    iconKey: "general",
    description: "Employee schedules synchronized from Deputy.",
    order: (last?.order ?? -1) + 1,
    kind: "event",
  })
  return (await ctx.db.get("categories", id))!
}

async function deputyEmployee(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    deputyEmployeeId: string
    displayName: string
  }
) {
  const mapping = await ctx.db
    .query("deputyEmployeeMappings")
    .withIndex("by_hubId_and_deputyEmployeeId", (q) =>
      q.eq("hubId", args.hubId).eq("deputyEmployeeId", args.deputyEmployeeId)
    )
    .unique()
  if (mapping) {
    const profile = await ctx.db.get(
      "employeeProfiles",
      mapping.employeeProfileId
    )
    if (profile) {
      if (profile.displayName !== args.displayName) {
        await ctx.db.patch("employeeProfiles", profile._id, {
          displayName: args.displayName,
          updatedAt: Date.now(),
        })
      }
      return profile._id
    }
    await ctx.db.delete("deputyEmployeeMappings", mapping._id)
  }

  const now = Date.now()
  const employeeProfileId = await ctx.db.insert("employeeProfiles", {
    hubId: args.hubId,
    displayName: args.displayName,
    status: "unclaimed",
    accessLevel: "viewer",
    createdBy: "deputy",
    createdAt: now,
    updatedAt: now,
    invitationStatus: "not-sent",
  })
  await ctx.db.insert("deputyEmployeeMappings", {
    hubId: args.hubId,
    deputyEmployeeId: args.deputyEmployeeId,
    employeeProfileId,
  })
  return employeeProfileId
}

export const getConnection = query({
  args: { hubId: v.id("hubs") },
  returns: v.union(
    v.null(),
    v.object({
      endpoint: v.string(),
      status: v.union(
        v.literal("connected"),
        v.literal("syncing"),
        v.literal("error")
      ),
      connectedAt: v.number(),
      lastSyncedAt: v.optional(v.number()),
      lastSyncError: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "owner")
    const connection = await ctx.db
      .query("deputyConnections")
      .withIndex("by_hubId", (q) => q.eq("hubId", args.hubId))
      .unique()
    if (!connection) return null
    return {
      endpoint: connection.endpoint,
      status: connection.status,
      connectedAt: connection.connectedAt,
      lastSyncedAt: connection.lastSyncedAt,
      lastSyncError: connection.lastSyncError,
    }
  },
})

export const connect = mutation({
  args: {
    hubId: v.id("hubs"),
    endpoint: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresInSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { identity } = await requireHubPermission(ctx, args.hubId, "owner")
    const endpoint = normalizeDeputyEndpoint(args.endpoint)
    if (!endpoint) throw new Error("invalidDeputyEndpoint")
    if (!args.accessToken.trim() || !args.refreshToken.trim()) {
      throw new Error("invalidDeputyCredentials")
    }
    const existing = await ctx.db
      .query("deputyConnections")
      .withIndex("by_hubId", (q) => q.eq("hubId", args.hubId))
      .unique()
    const tokenVersion = (existing?.tokenVersion ?? 0) + 1
    const encrypted = await encryptDeputyTokens({
      hubId: args.hubId,
      tokenVersion,
      tokens: {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
      },
    })
    const value = {
      hubId: args.hubId,
      endpoint,
      ...encrypted,
      tokenVersion,
      accessTokenExpiresAt:
        Date.now() + Math.max(60, args.expiresInSeconds) * 1000,
      status: "syncing" as const,
      connectedAt: existing?.connectedAt ?? Date.now(),
      connectedBy: identity.subject,
      lastSyncedAt: existing?.lastSyncedAt,
      lastSyncError: undefined,
    }
    const connectionId = existing
      ? (await ctx.db.replace("deputyConnections", existing._id, value),
        existing._id)
      : await ctx.db.insert("deputyConnections", value)
    await ctx.scheduler.runAfter(0, internal.deputySync.syncConnection, {
      connectionId,
    })
    return null
  },
})

export const requestSync = mutation({
  args: { hubId: v.id("hubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "owner")
    const connection = await ctx.db
      .query("deputyConnections")
      .withIndex("by_hubId", (q) => q.eq("hubId", args.hubId))
      .unique()
    if (!connection) throw new Error("deputyNotConnected")
    await ctx.db.patch("deputyConnections", connection._id, {
      status: "syncing",
      lastSyncError: undefined,
    })
    await ctx.scheduler.runAfter(0, internal.deputySync.syncConnection, {
      connectionId: connection._id,
    })
    return null
  },
})

export const disconnect = mutation({
  args: { hubId: v.id("hubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "owner")
    const connection = await ctx.db
      .query("deputyConnections")
      .withIndex("by_hubId", (q) => q.eq("hubId", args.hubId))
      .unique()
    if (connection) await ctx.db.delete("deputyConnections", connection._id)
    return null
  },
})

export const listConnectionIds = internalQuery({
  args: {},
  returns: v.array(v.id("deputyConnections")),
  handler: async (ctx) =>
    (await ctx.db.query("deputyConnections").take(500)).map(
      (connection) => connection._id
    ),
})

export const getConnectionForSync = internalQuery({
  args: { connectionId: v.id("deputyConnections") },
  returns: v.union(
    v.null(),
    v.object({
      hubId: v.id("hubs"),
      endpoint: v.string(),
      accessToken: v.string(),
      refreshToken: v.string(),
      accessTokenExpiresAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get("deputyConnections", args.connectionId)
    if (!connection) return null
    const tokens = await decryptDeputyTokens(connection)
    return {
      hubId: connection.hubId,
      endpoint: connection.endpoint,
      ...tokens,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
    }
  },
})

export const storeRefreshedTokens = internalMutation({
  args: {
    connectionId: v.id("deputyConnections"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresInSeconds: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get("deputyConnections", args.connectionId)
    if (!connection) return null
    const tokenVersion = connection.tokenVersion + 1
    await ctx.db.patch("deputyConnections", connection._id, {
      ...(await encryptDeputyTokens({
        hubId: connection.hubId,
        tokenVersion,
        tokens: {
          accessToken: args.accessToken,
          refreshToken: args.refreshToken,
        },
      })),
      tokenVersion,
      accessTokenExpiresAt:
        Date.now() + Math.max(60, args.expiresInSeconds) * 1000,
    })
    return null
  },
})

export const applyRosterBatch = internalMutation({
  args: {
    connectionId: v.id("deputyConnections"),
    syncId: v.string(),
    rosters: v.array(rosterValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get("deputyConnections", args.connectionId)
    if (!connection) return null
    const hub = await ctx.db.get("hubs", connection.hubId)
    if (!hub) return null
    const category = await deputyCategory(ctx, hub._id)
    const timeZone = hub.timeZone ?? "UTC"

    for (const roster of args.rosters) {
      const employeeProfileId = await deputyEmployee(ctx, {
        hubId: hub._id,
        deputyEmployeeId: roster.employeeId,
        displayName: roster.employeeName,
      })
      const slug = `deputy-shift-${roster.externalId}`
      const existing = await ctx.db
        .query("events")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hub._id).eq("slug", slug)
        )
        .unique()
      const sourceValue = {
        title: roster.employeeName,
        categoryId: category._id,
        start: wallTime(roster.startUtc, timeZone),
        end: wallTime(roster.endUtc, timeZone),
        allDay: false,
        startUtc: roster.startUtc,
        endUtc: roster.endUtc,
        icalUid: `deputy-roster-${roster.externalId}@workhal`,
        location: roster.areaName,
        published: roster.published,
        source: "deputy" as const,
        externalId: roster.externalId,
        sourceEmployeeId: roster.employeeId,
        sourceAreaId: roster.areaId,
        lastSourceSyncId: args.syncId,
        sourceDeleted: false,
      }
      const eventId = existing
        ? (await ctx.db.patch("events", existing._id, sourceValue),
          existing._id)
        : await ctx.db.insert("events", {
            hubId: hub._id,
            slug,
            description: "Scheduled shift from Deputy.",
            notes: "",
            isPrivate: true,
            ...sourceValue,
          })
      const relations = await ctx.db
        .query("eventEmployees")
        .withIndex("by_eventId_and_employeeProfileId", (q) =>
          q.eq("eventId", eventId)
        )
        .take(20)
      for (const relation of relations) {
        if (relation.employeeProfileId !== employeeProfileId) {
          await ctx.db.delete("eventEmployees", relation._id)
        }
      }
      if (
        !relations.some(
          (relation) => relation.employeeProfileId === employeeProfileId
        )
      ) {
        await ctx.db.insert("eventEmployees", {
          hubId: hub._id,
          eventId,
          employeeProfileId,
          addedAt: Date.now(),
          addedBy: "deputy",
        })
      }
    }
    return null
  },
})

export const hideStaleRosters = internalMutation({
  args: {
    connectionId: v.id("deputyConnections"),
    syncId: v.string(),
    windowStartUtc: v.string(),
    windowEndUtc: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get("deputyConnections", args.connectionId)
    if (!connection) return 0
    const hub = await ctx.db.get("hubs", connection.hubId)
    if (!hub) return 0
    const timeZone = hub.timeZone ?? "UTC"
    const stale = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_start", (q) =>
        q
          .eq("hubId", hub._id)
          .gte("start", wallTime(args.windowStartUtc, timeZone))
          .lte("start", wallTime(args.windowEndUtc, timeZone))
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("source"), "deputy"),
          q.neq(q.field("lastSourceSyncId"), args.syncId),
          q.neq(q.field("sourceDeleted"), true)
        )
      )
      .take(50)
    for (const event of stale) {
      await ctx.db.patch("events", event._id, {
        published: false,
        sourceDeleted: true,
      })
    }
    return stale.length
  },
})

export const finishSync = internalMutation({
  args: { connectionId: v.id("deputyConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get("deputyConnections", args.connectionId)
    if (!connection) return null
    await ctx.db.patch("deputyConnections", connection._id, {
      status: "connected",
      lastSyncedAt: Date.now(),
      lastSyncError: undefined,
    })
    return null
  },
})

export const failSync = internalMutation({
  args: {
    connectionId: v.id("deputyConnections"),
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get("deputyConnections", args.connectionId)
    if (!connection) return null
    await ctx.db.patch("deputyConnections", connection._id, {
      status: "error",
      lastSyncError: args.message.slice(0, 300),
    })
    return null
  },
})
