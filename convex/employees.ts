import { v } from "convex/values"

import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server"
import {
  hashCredential,
  requireIdentity,
  requireOrganizationHub,
  requireOwnedHub,
} from "./lib/access"
import { createNotification } from "./lib/notifications"

const invitationStatus = v.union(
  v.literal("not-sent"),
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("expired"),
  v.literal("revoked"),
  v.literal("failed")
)

function clean(value: string | undefined, max: number) {
  const result = value?.trim() ?? ""
  if (result.length > max) throw new Error("Employee detail is too long")
  return result || undefined
}

function normalizeEmail(value: string | undefined) {
  const email = clean(value, 200)?.toLocaleLowerCase()
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid email address")
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
    throw new Error("This account already has an active profile here")
  }
}

async function activateProfile(
  ctx: MutationCtx,
  profile: Doc<"employeeProfiles">,
  clerkUserId: string,
  now: number
) {
  if (profile.clerkUserId && profile.clerkUserId !== clerkUserId) {
    throw new Error("Employee profile is already claimed")
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
      kind: "workplace",
      title: "Employee account connected",
      message: `${profile.displayName} joined the workplace.`,
      href: "/manager/employees",
    })
  }
}

export const list = query({
  args: { hubId: v.id("hubs") },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
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

export const getForAdmin = query({
  args: { profileId: v.id("employeeProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("Employee not found")
    const hub = await requireOwnedHub(ctx, profile.hubId)
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
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const identity = await requireIdentity(ctx)
    const displayName = clean(args.displayName, 120)
    if (!displayName) throw new Error("Employee name is required")
    const normalizedEmail = normalizeEmail(args.email)
    if (normalizedEmail) {
      const duplicates = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_hubId_and_normalizedEmail", (q) =>
          q.eq("hubId", args.hubId).eq("normalizedEmail", normalizedEmail)
        )
        .take(10)
      if (duplicates.some((profile) => profile.status !== "deactivated")) {
        throw new Error("An employee profile already uses this email")
      }
    }
    const now = Date.now()
    return await ctx.db.insert("employeeProfiles", {
      hubId: args.hubId,
      displayName,
      email: normalizedEmail,
      normalizedEmail,
      department: clean(args.department, 120),
      jobTitle: clean(args.jobTitle, 120),
      status: "unclaimed",
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
      invitationStatus: "not-sent",
    })
  },
})

export const update = mutation({
  args: {
    profileId: v.id("employeeProfiles"),
    displayName: v.string(),
    email: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    const displayName = clean(args.displayName, 120)
    if (!displayName) throw new Error("Employee name is required")
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
        throw new Error("An employee profile already uses this email")
      }
    }
    await ctx.db.patch("employeeProfiles", profile._id, {
      displayName,
      email: normalizedEmail,
      normalizedEmail,
      department: clean(args.department, 120),
      jobTitle: clean(args.jobTitle, 120),
      updatedAt: Date.now(),
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
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    if (!profile.email)
      throw new Error("Add an email before sending an invitation")
    if (profile.status === "active")
      throw new Error("Employee is already active")
    if (profile.status === "deactivated")
      throw new Error("Reactivate the employee first")
    if (args.correlationCredential.length < 32) {
      throw new Error("Invitation credential is too short")
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
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    await ctx.db.patch("employeeProfiles", profile._id, {
      invitationId: args.invitationId,
      invitationStatus: "pending",
      invitationError: undefined,
      updatedAt: Date.now(),
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
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    await ctx.db.patch("employeeProfiles", profile._id, {
      invitationStatus: "failed",
      invitationError: args.message.slice(0, 500),
      updatedAt: Date.now(),
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
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    await ctx.db.patch("employeeProfiles", profile._id, {
      invitationStatus: args.status,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const claimByInvitation = mutation({
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
      throw new Error("Invitation does not match this workplace")
    }
    await activateProfile(ctx, profile, identity.subject, Date.now())
    return { hubSlug: hub.slug }
  },
})

export const createClaimLink = mutation({
  args: {
    profileId: v.id("employeeProfiles"),
    credential: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    const identity = await requireIdentity(ctx)
    if (profile.status === "active" || profile.status === "deactivated") {
      throw new Error("Only unclaimed or invited profiles can use claim links")
    }
    if (args.credential.length < 32)
      throw new Error("Claim credential is too short")
    const now = Date.now()
    if (
      args.expiresAt <= now ||
      args.expiresAt > now + 30 * 24 * 60 * 60 * 1000
    ) {
      throw new Error("Claim link expiry must be within 30 days")
    }
    const credentialHash = hashCredential(args.credential)
    const duplicate = await ctx.db
      .query("employeeClaimLinks")
      .withIndex("by_credentialHash", (q) =>
        q.eq("credentialHash", credentialHash)
      )
      .unique()
    if (duplicate) return duplicate._id
    return await ctx.db.insert("employeeClaimLinks", {
      hubId: profile.hubId,
      employeeProfileId: profile._id,
      credentialHash,
      expiresAt: args.expiresAt,
      createdAt: now,
      createdBy: identity.subject,
    })
  },
})

export const previewClaim = query({
  args: { credential: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("employeeClaimLinks")
      .withIndex("by_credentialHash", (q) =>
        q.eq("credentialHash", hashCredential(args.credential))
      )
      .unique()
    if (
      !link ||
      link.revokedAt !== undefined ||
      link.consumedAt !== undefined ||
      link.expiresAt <= args.now
    ) {
      return { kind: "invalid" as const }
    }
    const [profile, hub] = await Promise.all([
      ctx.db.get("employeeProfiles", link.employeeProfileId),
      ctx.db.get("hubs", link.hubId),
    ])
    if (!profile || !hub || profile.status === "deactivated") {
      return { kind: "invalid" as const }
    }
    return {
      kind: "ready" as const,
      workplaceName: hub.name,
      employeeDisplayName: profile.displayName,
      expiresAt: link.expiresAt,
    }
  },
})

export const resolveClaimForAuthenticatedUser = query({
  args: { credential: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx)
    const link = await ctx.db
      .query("employeeClaimLinks")
      .withIndex("by_credentialHash", (q) =>
        q.eq("credentialHash", hashCredential(args.credential))
      )
      .unique()
    if (
      !link ||
      link.revokedAt !== undefined ||
      link.consumedAt !== undefined ||
      link.expiresAt <= args.now
    ) {
      throw new Error("Claim link is invalid or expired")
    }
    const [profile, hub] = await Promise.all([
      ctx.db.get("employeeProfiles", link.employeeProfileId),
      ctx.db.get("hubs", link.hubId),
    ])
    if (
      !profile ||
      !hub?.clerkOrganizationId ||
      profile.status === "deactivated"
    ) {
      throw new Error("Claim link is not available")
    }
    return {
      organizationId: hub.clerkOrganizationId,
      hubSlug: hub.slug,
      profileId: profile._id,
    }
  },
})

export const completeClaim = mutation({
  args: { credential: v.string() },
  handler: async (ctx, args) => {
    const { hub, identity } = await requireOrganizationHub(ctx)
    const link = await ctx.db
      .query("employeeClaimLinks")
      .withIndex("by_credentialHash", (q) =>
        q.eq("credentialHash", hashCredential(args.credential))
      )
      .unique()
    const now = Date.now()
    if (
      !link ||
      link.hubId !== hub._id ||
      link.revokedAt !== undefined ||
      (link.consumedAt !== undefined &&
        link.consumedByClerkUserId !== identity.subject) ||
      link.expiresAt <= now
    ) {
      throw new Error("Claim link is invalid, expired, or already used")
    }
    const profile = await ctx.db.get("employeeProfiles", link.employeeProfileId)
    if (!profile) throw new Error("Employee profile no longer exists")
    await activateProfile(ctx, profile, identity.subject, now)
    if (link.consumedAt === undefined) {
      await ctx.db.patch("employeeClaimLinks", link._id, {
        consumedAt: now,
        consumedByClerkUserId: identity.subject,
      })
    }
    return { hubSlug: hub.slug }
  },
})

export const revokeClaimLink = mutation({
  args: { claimLinkId: v.id("employeeClaimLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get("employeeClaimLinks", args.claimLinkId)
    if (!link) return null
    await requireOwnedHub(ctx, link.hubId)
    if (link.consumedAt === undefined && link.revokedAt === undefined) {
      await ctx.db.patch("employeeClaimLinks", link._id, {
        revokedAt: Date.now(),
      })
    }
    return null
  },
})

export const listClaimLinks = query({
  args: { profileId: v.id("employeeProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    return await ctx.db
      .query("employeeClaimLinks")
      .withIndex("by_employeeProfileId_and_createdAt", (q) =>
        q.eq("employeeProfileId", profile._id)
      )
      .order("desc")
      .take(50)
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
  const claims = await ctx.db
    .query("employeeClaimLinks")
    .withIndex("by_employeeProfileId_and_createdAt", (q) =>
      q.eq("employeeProfileId", profile._id)
    )
    .take(100)
  for (const claim of claims) {
    if (claim.consumedAt === undefined && claim.revokedAt === undefined) {
      await ctx.db.patch("employeeClaimLinks", claim._id, { revokedAt: now })
    }
  }
}

export const deactivateAfterClerkRemoval = mutation({
  args: { profileId: v.id("employeeProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
    await deactivateProfileRecords(ctx, profile, Date.now())
    return null
  },
})

export const reactivateUnclaimed = mutation({
  args: { profileId: v.id("employeeProfiles") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("employeeProfiles", args.profileId)
    if (!profile) throw new Error("Employee not found")
    await requireOwnedHub(ctx, profile.hubId)
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
    return null
  },
})

export const reconcileMemberships = mutation({
  args: {
    hubId: v.id("hubs"),
    activeClerkUserIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
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
      } else if (
        activeUsers.has(profile.clerkUserId) &&
        profile.status !== "active" &&
        profile.status !== "deactivated"
      ) {
        await activateProfile(ctx, profile, profile.clerkUserId, now)
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
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_clerkOrganizationId", (q) =>
        q.eq("clerkOrganizationId", args.organizationId)
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
        q.eq("hubId", hub._id).eq("clerkUserId", args.clerkUserId)
      )
      .unique()
    if (!profile || profile.hubId !== hub._id) return null
    if (args.eventType === "organizationMembership.deleted") {
      await deactivateProfileRecords(ctx, profile, now)
    } else if (args.eventType.startsWith("organizationMembership.")) {
      await activateProfile(ctx, profile, args.clerkUserId, now)
    }
    return null
  },
})
