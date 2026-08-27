import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import {
  canReadPublishedHub,
  getIdentity,
  hashCredential,
  requireIdentity,
  requireHubPermission,
} from "./lib/access"

const notificationKind = v.union(
  v.literal("guide"),
  v.literal("event"),
  v.literal("announcement"),
  v.literal("document"),
  v.literal("question"),
  v.literal("workplace"),
  v.literal("trade")
)

const notificationItem = v.object({
  id: v.id("notifications"),
  kind: notificationKind,
  title: v.optional(v.string()),
  message: v.optional(v.string()),
  titleKey: v.optional(v.string()),
  messageKey: v.optional(v.string()),
  messageValues: v.optional(
    v.record(v.string(), v.union(v.string(), v.number()))
  ),
  href: v.string(),
  createdAt: v.number(),
  isOwn: v.boolean(),
})

const notificationFeed = v.object({
  notifications: v.array(notificationItem),
  lastReadAt: v.number(),
  unreadCount: v.number(),
})

const NOTIFICATION_FEED_LIMIT = 100

const notificationFields = (
  notification: Doc<"notifications">,
  viewerKey: string
) => ({
  id: notification._id,
  kind: notification.kind,
  title: notification.title,
  message: notification.message,
  titleKey: notification.titleKey,
  messageKey: notification.messageKey,
  messageValues: notification.messageValues,
  href: notification.href,
  createdAt: notification._creationTime,
  isOwn: notification.actorViewerKey === viewerKey,
})

async function getLastReadAt(
  ctx: QueryCtx,
  hubId: Doc<"hubs">["_id"],
  viewerKey: string,
  viewerType: "employee" | "manager"
) {
  const state = await ctx.db
    .query("notificationReadStates")
    .withIndex("by_hubId_and_viewerKey_and_viewerType", (q) =>
      q
        .eq("hubId", hubId)
        .eq("viewerKey", viewerKey)
        .eq("viewerType", viewerType)
    )
    .unique()
  return state?.lastReadAt ?? 0
}

async function setLastReadAt(
  ctx: MutationCtx,
  hubId: Doc<"hubs">["_id"],
  viewerKey: string,
  viewerType: "employee" | "manager",
  lastReadAt: number,
  employeeProfileId?: Id<"employeeProfiles">
) {
  const existing = await ctx.db
    .query("notificationReadStates")
    .withIndex("by_hubId_and_viewerKey_and_viewerType", (q) =>
      q
        .eq("hubId", hubId)
        .eq("viewerKey", viewerKey)
        .eq("viewerType", viewerType)
    )
    .unique()
  const nextLastReadAt = Math.max(existing?.lastReadAt ?? 0, lastReadAt)
  if (!existing && nextLastReadAt === 0) return 0
  if (existing) {
    await ctx.db.patch("notificationReadStates", existing._id, {
      lastReadAt: nextLastReadAt,
      employeeProfileId,
    })
  } else {
    await ctx.db.insert("notificationReadStates", {
      hubId,
      employeeProfileId,
      viewerKey,
      viewerType,
      lastReadAt: nextLastReadAt,
    })
  }
  return nextLastReadAt
}

async function employeeViewer(
  ctx: QueryCtx | MutationCtx,
  args: {
    hubSlug: string
    credential?: string
    guestDeviceId?: string
  }
) {
  const hub = await ctx.db
    .query("hubs")
    .withIndex("by_slug", (q) => q.eq("slug", args.hubSlug))
    .unique()
  if (!hub || !(await canReadPublishedHub(ctx, hub, args.credential))) {
    throw new Error("hubAccessRequired")
  }

  const identity = await getIdentity(ctx)
  if (identity) {
    const profiles = await ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_clerkUserId", (q) =>
        q.eq("hubId", hub._id).eq("clerkUserId", identity.subject)
      )
      .take(10)
    const profile = profiles.find((candidate) => candidate.status === "active")
    return {
      hub,
      viewerKey: `identity:${identity.tokenIdentifier}`,
      employeeProfileId: profile?._id,
    }
  }

  const guestDeviceId = args.guestDeviceId?.trim()
  if (
    !guestDeviceId ||
    guestDeviceId.length < 16 ||
    guestDeviceId.length > 100
  ) {
    throw new Error("thisDeviceCouldNotBeIdentified")
  }
  return {
    hub,
    viewerKey: `guest:${hashCredential(guestDeviceId)}`,
    employeeProfileId: undefined,
  }
}

async function employeeNotifications(
  ctx: QueryCtx | MutationCtx,
  viewer: Awaited<ReturnType<typeof employeeViewer>>
) {
  const [broadcast, tradeBroadcast, personal] = await Promise.all([
    ctx.db
      .query("notifications")
      .withIndex("by_hubId_and_audience", (q) =>
        q.eq("hubId", viewer.hub._id).eq("audience", "employees")
      )
      .order("desc")
      .take(NOTIFICATION_FEED_LIMIT),
    viewer.employeeProfileId
      ? ctx.db
          .query("notifications")
          .withIndex("by_hubId_and_audience", (q) =>
            q.eq("hubId", viewer.hub._id).eq("audience", "trade-employees")
          )
          .order("desc")
          .take(NOTIFICATION_FEED_LIMIT)
      : [],
    viewer.employeeProfileId
      ? ctx.db
          .query("notifications")
          .withIndex("by_employeeProfileId", (q) =>
            q.eq("employeeProfileId", viewer.employeeProfileId)
          )
          .order("desc")
          .take(NOTIFICATION_FEED_LIMIT * 5)
          .then((notifications) =>
            notifications.filter(
              (notification) => notification.audience === "employee"
            )
          )
      : [],
  ])
  const visibleBroadcast = viewer.employeeProfileId
    ? broadcast
    : broadcast.filter((notification) => notification.kind !== "trade")
  return [...visibleBroadcast, ...tradeBroadcast, ...personal]
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, NOTIFICATION_FEED_LIMIT)
}

async function latestEmployeeNotificationTime(
  ctx: QueryCtx | MutationCtx,
  viewer: Awaited<ReturnType<typeof employeeViewer>>
) {
  const latest = (await employeeNotifications(ctx, viewer)).find(
    (notification) => notification.actorViewerKey !== viewer.viewerKey
  )
  return latest?._creationTime ?? 0
}

async function managerNotifications(
  ctx: QueryCtx | MutationCtx,
  hubId: Id<"hubs">,
  includeOwnerNotifications: boolean
) {
  const [tradeNotifications, ownerNotifications] = await Promise.all([
    ctx.db
      .query("notifications")
      .withIndex("by_hubId_and_audience", (q) =>
        q.eq("hubId", hubId).eq("audience", "trade-managers")
      )
      .order("desc")
      .take(NOTIFICATION_FEED_LIMIT),
    includeOwnerNotifications
      ? ctx.db
          .query("notifications")
          .withIndex("by_hubId_and_audience", (q) =>
            q.eq("hubId", hubId).eq("audience", "managers")
          )
          .order("desc")
          .take(NOTIFICATION_FEED_LIMIT)
      : [],
  ])
  return [...tradeNotifications, ...ownerNotifications]
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, NOTIFICATION_FEED_LIMIT)
}

export const listEmployee = query({
  args: {
    hubSlug: v.string(),
    credential: v.optional(v.string()),
    guestDeviceId: v.optional(v.string()),
  },
  returns: notificationFeed,
  handler: async (ctx, args) => {
    const viewer = await employeeViewer(ctx, args)
    const notifications = await employeeNotifications(ctx, viewer)
    const lastReadAt = await getLastReadAt(
      ctx,
      viewer.hub._id,
      viewer.viewerKey,
      "employee"
    )
    return {
      notifications: notifications.map((notification) =>
        notificationFields(notification, viewer.viewerKey)
      ),
      lastReadAt,
      unreadCount: notifications.filter(
        (notification) =>
          notification.actorViewerKey !== viewer.viewerKey &&
          notification._creationTime > lastReadAt
      ).length,
    }
  },
})

export const markEmployeeRead = mutation({
  args: {
    hubSlug: v.string(),
    credential: v.optional(v.string()),
    guestDeviceId: v.optional(v.string()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const viewer = await employeeViewer(ctx, args)
    return await setLastReadAt(
      ctx,
      viewer.hub._id,
      viewer.viewerKey,
      "employee",
      await latestEmployeeNotificationTime(ctx, viewer),
      viewer.employeeProfileId
    )
  },
})

export const listManager = query({
  args: { hubId: v.id("hubs") },
  returns: notificationFeed,
  handler: async (ctx, args) => {
    const [access, identity] = await Promise.all([
      requireHubPermission(ctx, args.hubId, "manager"),
      requireIdentity(ctx),
    ])
    const { hub } = access
    const viewerKey = `identity:${identity.tokenIdentifier}`
    const notifications = await managerNotifications(
      ctx,
      hub._id,
      access.permission === "owner"
    )
    const lastReadAt = await getLastReadAt(ctx, hub._id, viewerKey, "manager")
    return {
      notifications: notifications.map((notification) =>
        notificationFields(notification, viewerKey)
      ),
      lastReadAt,
      unreadCount: notifications.filter(
        (notification) =>
          notification.actorViewerKey !== viewerKey &&
          notification._creationTime > lastReadAt
      ).length,
    }
  },
})

export const markManagerRead = mutation({
  args: { hubId: v.id("hubs") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const [access, identity] = await Promise.all([
      requireHubPermission(ctx, args.hubId, "manager"),
      requireIdentity(ctx),
    ])
    const { hub } = access
    const viewerKey = `identity:${identity.tokenIdentifier}`
    const latest = (
      await managerNotifications(ctx, hub._id, access.permission === "owner")
    ).find((notification) => notification.actorViewerKey !== viewerKey)
    return await setLastReadAt(
      ctx,
      hub._id,
      viewerKey,
      "manager",
      latest?._creationTime ?? 0
    )
  },
})
