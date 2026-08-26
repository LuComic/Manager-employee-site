import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import {
  hashCredential,
  requireHubEditingPermission,
  requireHubPermission,
  requireOrganizationHub,
} from "./lib/access"
import { auditActorFromIdentity, createAuditLog } from "./lib/auditLogs"
import { createNotification } from "./lib/notifications"

const invitationStatus = v.union(
  v.literal("not-sent"),
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("expired"),
  v.literal("revoked"),
  v.literal("failed")
)
const accessLevel = v.union(
  v.literal("viewer"),
  v.literal("editor"),
  v.literal("manager")
)

function clean(value: string | undefined, max: number) {
  const result = value?.trim() ?? ""
  if (result.length > max) throw new Error("employeeDetailIsTooLong")
  return result || undefined
}

function normalizeEmail(value: string | undefined) {
  const email = clean(value, 200)?.toLocaleLowerCase()
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("enterAValidEmailAddress")
  }
  return email
}

async function ensureNoActiveProfileForUser(
  ctx: MutationCtx,
  hubId: Id<"hubs">,
  clerkUserId: string,
  exceptProfileId?: Id<"employeeProfiles">
) {
  const existing = await ctx.db
    .query("employeeProfiles")
    .withIndex("by_hubId_and_clerkUserId", (q) =>
      q.eq("hubId", hubId).eq("clerkUserId", clerkUserId)
    )
    .take(10)
  if (
    existing.some(
      (profile) =>
        profile._id !== exceptProfileId && profile.status === "active"
    )
  ) {
    throw new Error("accountAlreadyActiveProfileHere")
  }
}

async function activateProfile(
  ctx: MutationCtx,
  profile: Doc<"employeeProfiles">,
  clerkUserId: string,
  now: number
) {
  if (profile.clerkUserId && profile.clerkUserId !== clerkUserId) {
    throw new Error("employeeProfileIsAlreadyConnected")
  }
  await ensureNoActiveProfileForUser(
    ctx,
    profile.hubId,
    clerkUserId,
    profile._id
  )
  await ctx.db.patch("employeeProfiles", profile._id, {
    clerkUserId,
    status: "active",
    invitationStatus:
      profile.invitationStatus === "pending"
        ? "accepted"
        : profile.invitationStatus,
    activatedAt: profile.activatedAt ?? now,
    deactivatedAt: undefined,
    updatedAt: now,
  })
  if (profile.status !== "active") {
    await createNotification(ctx, {
      hubId: profile.hubId,
      audience: "managers",
      employeeProfileId: profile._id,
      kind: "workplace",
      titleKey: "notificationEmployeeAccountConnected",
      messageKey: "notificationEmployeeJoinedWorkplace",
      messageValues: { name: profile.displayName },
      href: "/manager/employees",
    })
  }
}

export const list = query({
  args: { hubId: v.id("hubs") },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "owner")
    const profiles = await ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_displayName", (q) => q.eq("hubId", args.hubId))
      .take(500)
    return profiles.map((profile) => ({
      id: profile._id,
      displayName: profile.displayName,
      email: profile.email,
      department: profile.department,
      jobTitle: profile.jobTitle,
      status: profile.status,
      accessLevel: profile.accessLevel ?? "viewer",
      clerkUserId: profile.clerkUserId,
      invitationId: profile.invitationId,
      invitationStatus: profile.invitationStatus,
      invitationError: profile.invitationError,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      invitedAt: profile.invitedAt,
      activatedAt: profile.activatedAt,
      deactivatedAt: profile.deactivatedAt,
    }))
  },
})

export const listAssignable = query({
  args: {
    hubId: v.id("hubs"),
    workerSection: v.optional(
      v.union(v.literal("events"), v.literal("documents"))
    ),
  },
  returns: v.array(
    v.object({
      id: v.id("employeeProfiles"),
      displayName: v.string(),
      status: v.union(
        v.literal("unclaimed"),
        v.literal("invited"),
        v.literal("active"),
        v.literal("deactivated")
      ),
    })
  ),
  handler: async (ctx, args) => {
    if (args.workerSection) {
      await requireHubEditingPermission(ctx, args.hubId, args.workerSection)
    } else {
      await requireHubPermission(ctx, args.hubId, "editor")
    }
    const profiles = await ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_displayName", (q) => q.eq("hubId", args.hubId))
      .take(500)
    return profiles.map((profile) => ({
      id: profile._id,
      displayName: profile.displayName,
      status: profile.status,
    }))
  },
})

async function employeeHasShiftTrades(
  ctx: QueryCtx | MutationCtx,
  profileId: Id<"employeeProfiles">
) {
  const [publishedTrade, offeredTrade] = await Promise.all([
    ctx.db
      .query("shiftTrades")
      .withIndex("by_publisherId", (q) => q.eq("publisherId", profileId))
      .first(),
    ctx.db
      .query("shiftTrades")
      .withIndex("by_offeringEmployeeId", (q) =>
        q.eq("offeringEmployeeId", profileId)
      )
      .first(),
  ])
  return Boolean(publishedTrade || offeredTrade)
}

export const getForAdmin = query({
  args: { profileId: v.id("employeeProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { hub } = await requireHubPermission(ctx, profile.hubId, "owner")
    return {
      profile: {
        id: profile._id,
        email: profile.email,
        displayName: profile.displayName,
        clerkUserId: profile.clerkUserId,
        invitationId: profile.invitationId,
        invitationStatus: profile.invitationStatus,
        status: profile.status,
      },
      organizationId: hub.clerkOrganizationId,
      hubSlug: hub.slug,
      hasShiftTrades: await employeeHasShiftTrades(ctx, profile._id),
    }
  },
})

export const create = mutation({
  args: {
    hubId: v.id("hubs"),
    displayName: v.string(),
    email: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    accessLevel: v.optional(accessLevel),
  },
  handler: async (ctx, args) => {
    const { identity, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "owner"
    )
    const displayName = clean(args.displayName, 120)
    if (!displayName) throw new Error("employeeNameIsRequired")
    const normalizedEmail = normalizeEmail(args.email)
    if (normalizedEmail) {
      const duplicates = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_hubId_and_normalizedEmail", (q) =>
          q.eq("hubId", args.hubId).eq("normalizedEmail", normalizedEmail)
        )
        .take(10)
      if (duplicates.some((profile) => profile.status !== "deactivated")) {
        throw new Error("employeeProfileAlreadyUsesEmail")
      }
    }
    const now = Date.now()
    const profileId = await ctx.db.insert("employeeProfiles", {
      hubId: args.hubId,
      displayName,
      email: normalizedEmail,
      normalizedEmail,
      department: clean(args.department, 120),
      jobTitle: clean(args.jobTitle, 120),
      status: "unclaimed",
      accessLevel: args.accessLevel ?? "viewer",
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
      invitationStatus: "not-sent",
    })
    await createAuditLog(ctx, auditActor, {
      hubId: args.hubId,
      action: "created",
      entityType: "employee",
      entityId: profileId,
      entityTitle: displayName,
    })
    return profileId
  },
})

export const update = mutation({
  args: {
    profileId: v.id("employeeProfiles"),
    displayName: v.string(),
    email: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    accessLevel: v.optional(accessLevel),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    const displayName = clean(args.displayName, 120)
    if (!displayName) throw new Error("employeeNameIsRequired")
    const normalizedEmail = normalizeEmail(args.email)
    if (normalizedEmail !== profile.normalizedEmail) {
      const duplicates = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_hubId_and_normalizedEmail", (q) =>
          q.eq("hubId", profile.hubId).eq("normalizedEmail", normalizedEmail)
        )
        .take(10)
      if (
        duplicates.some(
          (other) => other._id !== profile._id && other.status !== "deactivated"
        )
      ) {
        throw new Error("employeeProfileAlreadyUsesEmail")
      }
    }
    await ctx.db.patch("employeeProfiles", profile._id, {
      displayName,
      email: normalizedEmail,
      normalizedEmail,
      department: clean(args.department, 120),
      jobTitle: clean(args.jobTitle, 120),
      accessLevel: args.accessLevel ?? profile.accessLevel ?? "viewer",
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "edited",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: displayName,
    })
    return null
  },
})

export const prepareInvitation = mutation({
  args: {
    profileId: v.id("employeeProfiles"),
    correlationCredential: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    if (!profile.email) throw new Error("addEmailBeforeSendingInvitation")
    if (profile.status === "active") throw new Error("employeeIsAlreadyActive")
    if (profile.status === "deactivated")
      throw new Error("reactivateTheEmployeeFirst")
    if (args.correlationCredential.length < 32) {
      throw new Error("invitationCredentialIsTooShort")
    }
    const now = Date.now()
    await ctx.db.patch("employeeProfiles", profile._id, {
      status: "invited",
      invitationStatus: "pending",
      invitationCorrelationHash: hashCredential(args.correlationCredential),
      invitationError: undefined,
      invitedAt: now,
      updatedAt: now,
    })
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "edited",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: profile.displayName,
    })
    return { email: profile.email }
  },
})

export const recordInvitation = mutation({
  args: {
    profileId: v.id("employeeProfiles"),
    invitationId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    await ctx.db.patch("employeeProfiles", profile._id, {
      invitationId: args.invitationId,
      invitationStatus: "pending",
      invitationError: undefined,
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "edited",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: profile.displayName,
    })
    return null
  },
})

export const recordInvitationFailure = mutation({
  args: {
    profileId: v.id("employeeProfiles"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    await ctx.db.patch("employeeProfiles", profile._id, {
      invitationStatus: "failed",
      invitationError: args.message.slice(0, 500),
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "edited",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: profile.displayName,
    })
    return null
  },
})

export const markInvitationStatus = mutation({
  args: {
    profileId: v.id("employeeProfiles"),
    status: invitationStatus,
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    await ctx.db.patch("employeeProfiles", profile._id, {
      invitationStatus: args.status,
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "edited",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: profile.displayName,
    })
    return null
  },
})

export const activateByInvitation = mutation({
  args: { correlationCredential: v.string() },
  handler: async (ctx, args) => {
    const { hub, identity } = await requireOrganizationHub(ctx)
    const profile = await ctx.db
      .query("employeeProfiles")
      .withIndex("by_invitationCorrelationHash", (q) =>
        q.eq(
          "invitationCorrelationHash",
          hashCredential(args.correlationCredential)
        )
      )
      .unique()
    if (!profile || profile.hubId !== hub._id) {
      throw new Error("invitationDoesNotMatchThisWorkplace")
    }
    await activateProfile(ctx, profile, identity.subject, Date.now())
    await createAuditLog(
      ctx,
      auditActorFromIdentity(identity, profile.displayName),
      {
        hubId: profile.hubId,
        action: "edited",
        entityType: "employee",
        entityId: profile._id,
        entityTitle: profile.displayName,
      }
    )
    return { hubSlug: hub.slug }
  },
})

async function deactivateProfileRecords(
  ctx: MutationCtx,
  profile: Doc<"employeeProfiles">,
  now: number
) {
  await ctx.db.patch("employeeProfiles", profile._id, {
    status: "deactivated",
    invitationStatus:
      profile.invitationStatus === "pending"
        ? "revoked"
        : profile.invitationStatus,
    deactivatedAt: now,
    updatedAt: now,
  })
}

export const deactivateAfterClerkRemoval = mutation({
  args: { profileId: v.id("employeeProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    await deactivateProfileRecords(ctx, profile, Date.now())
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "edited",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: profile.displayName,
    })
    return null
  },
})

export const removeProfileBatch = mutation({
  args: { profileId: v.id("employeeProfiles") },
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    if (await employeeHasShiftTrades(ctx, profile._id)) {
      throw new Error("employeeHasShiftTrades")
    }

    const [
      eventAssignments,
      documentAssignments,
      employeeNotifications,
      notificationReadStates,
    ] = await Promise.all([
      ctx.db
        .query("eventEmployees")
        .withIndex("by_employeeProfileId_and_eventId", (q) =>
          q.eq("employeeProfileId", profile._id)
        )
        .take(100),
      ctx.db
        .query("documentEmployees")
        .withIndex("by_employeeProfileId_and_documentId", (q) =>
          q.eq("employeeProfileId", profile._id)
        )
        .take(100),
      ctx.db
        .query("notifications")
        .withIndex("by_employeeProfileId", (q) =>
          q.eq("employeeProfileId", profile._id)
        )
        .take(100),
      ctx.db
        .query("notificationReadStates")
        .withIndex("by_employeeProfileId", (q) =>
          q.eq("employeeProfileId", profile._id)
        )
        .take(100),
    ])

    for (const assignment of eventAssignments) {
      await ctx.db.delete("eventEmployees", assignment._id)
    }
    for (const assignment of documentAssignments) {
      await ctx.db.delete("documentEmployees", assignment._id)
    }
    for (const notification of employeeNotifications) {
      await ctx.db.delete("notifications", notification._id)
    }
    for (const readState of notificationReadStates) {
      await ctx.db.delete("notificationReadStates", readState._id)
    }

    if (
      eventAssignments.length > 0 ||
      documentAssignments.length > 0 ||
      employeeNotifications.length > 0 ||
      notificationReadStates.length > 0
    ) {
      return { removed: false }
    }

    await ctx.db.delete("employeeProfiles", profile._id)
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "deleted",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: profile.displayName,
    })
    return { removed: true }
  },
})

export const reactivateUnclaimed = mutation({
  args: { profileId: v.id("employeeProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("employeeNotFound")
    const { auditActor } = await requireHubPermission(
      ctx,
      profile.hubId,
      "owner"
    )
    await ctx.db.patch("employeeProfiles", profile._id, {
      clerkUserId: undefined,
      status: "unclaimed",
      invitationId: undefined,
      invitationStatus: "not-sent",
      invitationCorrelationHash: undefined,
      invitationError: undefined,
      activatedAt: undefined,
      deactivatedAt: undefined,
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: profile.hubId,
      action: "edited",
      entityType: "employee",
      entityId: profile._id,
      entityTitle: profile.displayName,
    })
    return null
  },
})

export const reconcileMemberships = mutation({
  args: {
    hubId: v.id("hubs"),
    activeClerkUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { auditActor } = await requireHubPermission(ctx, args.hubId, "owner")
    const activeUsers = new Set(args.activeClerkUserIds.slice(0, 20))
    const profiles = await ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_displayName", (q) => q.eq("hubId", args.hubId))
      .take(500)
    const now = Date.now()
    for (const profile of profiles) {
      if (!profile.clerkUserId) continue
      if (
        !activeUsers.has(profile.clerkUserId) &&
        profile.status === "active"
      ) {
        await deactivateProfileRecords(ctx, profile, now)
        await createAuditLog(ctx, auditActor, {
          hubId: profile.hubId,
          action: "edited",
          entityType: "employee",
          entityId: profile._id,
          entityTitle: profile.displayName,
        })
      } else if (
        activeUsers.has(profile.clerkUserId) &&
        profile.status !== "active" &&
        profile.status !== "deactivated"
      ) {
        await activateProfile(ctx, profile, profile.clerkUserId, now)
        await createAuditLog(ctx, auditActor, {
          hubId: profile.hubId,
          action: "edited",
          entityType: "employee",
          entityId: profile._id,
          entityTitle: profile.displayName,
        })
      }
    }
    return null
  },
})

export const applyClerkWebhook = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    organizationId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    invitationId: v.optional(v.string()),
    invitationStatus: v.optional(invitationStatus),
    correlationCredential: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("clerkWebhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .unique()
    if (duplicate) return null
    const now = Date.now()
    await ctx.db.insert("clerkWebhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      receivedAt: now,
    })

    if (args.invitationId && args.invitationStatus) {
      const profile = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_invitationId", (q) =>
          q.eq("invitationId", args.invitationId)
        )
        .unique()
      if (profile) {
        await ctx.db.patch("employeeProfiles", profile._id, {
          invitationStatus: args.invitationStatus,
          updatedAt: now,
        })
      }
    }

    if (!args.organizationId || !args.clerkUserId) return null
    const organizationId = args.organizationId
    const clerkUserId = args.clerkUserId
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_clerkOrganizationId", (q) =>
        q.eq("clerkOrganizationId", organizationId)
      )
      .unique()
    if (!hub) return null
    let profile: Doc<"employeeProfiles"> | null = null
    if (args.correlationCredential) {
      profile = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_invitationCorrelationHash", (q) =>
          q.eq(
            "invitationCorrelationHash",
            hashCredential(args.correlationCredential!)
          )
        )
        .unique()
    }
    profile ??= await ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_clerkUserId", (q) =>
        q.eq("hubId", hub._id).eq("clerkUserId", clerkUserId)
      )
      .unique()
    if (!profile || profile.hubId !== hub._id) return null
    if (args.eventType === "organizationMembership.deleted") {
      await deactivateProfileRecords(ctx, profile, now)
    } else if (args.eventType.startsWith("organizationMembership.")) {
      await activateProfile(ctx, profile, clerkUserId, now)
    }
    return null
  },
})
