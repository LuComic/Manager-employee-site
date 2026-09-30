import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, internalQuery, query } from "./_generated/server"
import { betaPolicy, canCreateOrganization } from "./lib/betaAccess"
import { requireIdentity } from "./lib/access"

// Operator-only. No client can approve itself or change the beta switch.
export const configure = internalMutation({
  args: { enabled: v.boolean(), creatorEmails: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const creatorEmails = [
      ...new Set(args.creatorEmails.map((email) => email.trim().toLowerCase())),
    ]
    if (
      creatorEmails.length > 200 ||
      creatorEmails.some((email) => !/^\S+@\S+\.\S+$/.test(email))
    )
      throw new Error("enterAValidEmailAddress")
    const existing = await betaPolicy(ctx)
    const value = {
      key: "signup" as const,
      enabled: args.enabled,
      creatorEmails,
    }
    if (existing) await ctx.db.patch("betaPolicy", existing._id, value)
    else await ctx.db.insert("betaPolicy", value)
    await ctx.scheduler.runAfter(0, internal.betaClerk.sync, {})
    return null
  },
})

export const policy = internalQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ enabled: v.boolean(), creatorEmails: v.array(v.string()) })
  ),
  handler: async (ctx) => {
    const policy = await betaPolicy(ctx)
    return policy
      ? { enabled: policy.enabled, creatorEmails: policy.creatorEmails }
      : null
  },
})

export const getMyAccess = query({
  args: {},
  returns: v.object({ canCreateOrganization: v.boolean() }),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    return {
      canCreateOrganization: await canCreateOrganization(ctx, identity.subject),
    }
  },
})

export const recordVerifiedEmails = internalMutation({
  args: { clerkUserId: v.string(), verifiedEmails: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("accountEmails")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique()
    if (existing) await ctx.db.patch("accountEmails", existing._id, args)
    else await ctx.db.insert("accountEmails", args)
    return null
  },
})

export const employeeEmails = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    page: v.array(v.string()),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("employeeProfiles")
      .paginate(args.paginationOpts)
    return {
      page: result.page.flatMap((profile) =>
        profile.normalizedEmail &&
        profile.status !== "deactivated" &&
        !profile.pendingClerkActionId
          ? [profile.normalizedEmail]
          : []
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    }
  },
})

export const matchingProfiles = internalQuery({
  args: { clerkUserId: v.string(), verifiedEmails: v.array(v.string()) },
  returns: v.array(
    v.object({
      profileId: v.id("employeeProfiles"),
      email: v.string(),
      organizationId: v.string(),
      hubSlug: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const matches = []
    for (const email of args.verifiedEmails) {
      const profiles = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", email))
        .take(100)
      for (const profile of profiles) {
        if (
          profile.status === "deactivated" ||
          profile.pendingClerkActionId ||
          (profile.clerkUserId && profile.clerkUserId !== args.clerkUserId)
        )
          continue
        const hub = await ctx.db.get("hubs", profile.hubId)
        if (hub)
          matches.push({
            profileId: profile._id,
            email,
            organizationId: hub.clerkOrganizationId,
            hubSlug: hub.slug,
          })
      }
    }
    const byOrganization = new Map<string, typeof matches>()
    for (const match of matches) {
      const candidates = byOrganization.get(match.organizationId) ?? []
      candidates.push(match)
      byOrganization.set(match.organizationId, candidates)
    }
    const selected: typeof matches = []
    for (const candidates of byOrganization.values()) {
      const firstProfile = await ctx.db.get(
        "employeeProfiles",
        candidates[0].profileId
      )
      if (!firstProfile) continue
      const linked = await ctx.db
        .query("employeeProfiles")
        .withIndex("by_hubId_and_clerkUserId", (q) =>
          q.eq("hubId", firstProfile.hubId).eq("clerkUserId", args.clerkUserId)
        )
        .take(10)
      const active = linked.find((profile) => profile.status === "active")
      if (active) {
        const match = candidates.find(
          (candidate) => candidate.profileId === active._id
        )
        if (match) selected.push(match)
      } else if (candidates.length === 1) {
        selected.push(candidates[0])
      }
    }
    return selected
  },
})

// Serialize Clerk reconciliation. A crashed/timed-out action releases its lease
// after ten minutes; normal changes while syncing queue one fresh pass.
export const beginSync = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const policy = await betaPolicy(ctx)
    if (!policy) return false
    if (
      policy.syncStartedAt &&
      Date.now() - policy.syncStartedAt < 10 * 60_000
    ) {
      await ctx.db.patch("betaPolicy", policy._id, { syncAgain: true })
      return false
    }
    await ctx.db.patch("betaPolicy", policy._id, {
      syncStartedAt: Date.now(),
      syncAgain: false,
    })
    return true
  },
})
export const finishSync = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const policy = await betaPolicy(ctx)
    if (!policy) return null
    await ctx.db.patch("betaPolicy", policy._id, {
      syncStartedAt: undefined,
      syncAgain: false,
    })
    if (policy.syncAgain)
      await ctx.scheduler.runAfter(0, internal.betaClerk.sync, {})
    return null
  },
})
