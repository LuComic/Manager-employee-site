"use node"

import { createClerkClient, type User } from "@clerk/backend"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { action, internalAction, type ActionCtx } from "./_generated/server"

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) throw new Error("couldNotConnectAccount")
  return createClerkClient({ secretKey })
}

async function syncUser(
  ctx: ActionCtx,
  clerkUserId: string,
  listedUser?: User
): Promise<string[]> {
  const clerk = clerkClient()
  // Always fetch current state; webhook delivery order is not authoritative.
  const user = listedUser ?? (await clerk.users.getUser(clerkUserId))
  const verifiedEmails = user.emailAddresses
    .filter((email) => email.verification?.status === "verified")
    .map((email) => email.emailAddress.trim().toLowerCase())
  await ctx.runMutation(internal.betaAccess.recordVerifiedEmails, {
    clerkUserId,
    verifiedEmails,
  })
  const policy = await ctx.runQuery(internal.betaAccess.policy, {})
  if (policy) {
    const enabled =
      !policy.enabled ||
      verifiedEmails.some((email) => policy.creatorEmails.includes(email))
    if (user.createOrganizationEnabled !== enabled) {
      await clerk.users.updateUser(clerkUserId, {
        createOrganizationEnabled: enabled,
      })
    }
  }
  return verifiedEmails
}

export const refreshUser = internalAction({
  args: { clerkUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await syncUser(ctx, args.clerkUserId)
    return null
  },
})

// Called once after sign-in. The caller never supplies an email or user ID.
export const connectAccount = action({
  args: {},
  returns: v.array(
    v.object({ organizationId: v.string(), hubSlug: v.string() })
  ),
  handler: async (
    ctx
  ): Promise<{ organizationId: string; hubSlug: string }[]> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("notAuthenticated")
    const verifiedEmails = await syncUser(ctx, identity.subject)
    const matches = await ctx.runQuery(internal.betaAccess.matchingProfiles, {
      clerkUserId: identity.subject,
      verifiedEmails,
    })
    const clerk = clerkClient()
    const connected = []
    for (const match of matches) {
      const memberships =
        await clerk.organizations.getOrganizationMembershipList({
          organizationId: match.organizationId,
          userId: [identity.subject],
          limit: 1,
        })
      let created = false
      if (!memberships.data.length) {
        try {
          await clerk.organizations.createOrganizationMembership({
            organizationId: match.organizationId,
            userId: identity.subject,
            role: "org:member",
          })
          created = true
        } catch (error) {
          // A parallel sign-in/invitation may have created this membership.
          const current =
            await clerk.organizations.getOrganizationMembershipList({
              organizationId: match.organizationId,
              userId: [identity.subject],
              limit: 1,
            })
          if (!current.data.length) throw error
        }
      }
      try {
        await ctx.runMutation(internal.employees.activateByVerifiedEmail, {
          profileId: match.profileId,
          email: match.email,
          clerkUserId: identity.subject,
          tokenIdentifier: identity.tokenIdentifier,
        })
      } catch (error) {
        // The manager may have changed/removed the profile during the API call.
        if (created)
          await clerk.organizations.deleteOrganizationMembership({
            organizationId: match.organizationId,
            userId: identity.subject,
          })
        throw error
      }
      connected.push({
        organizationId: match.organizationId,
        hubSlug: match.hubSlug,
      })
    }
    return connected
  },
})

// Reconciles the authoritative signup list and user creation overrides. No emails
// are sent. Retried by the cron as well as after employee/configuration changes.
export const sync = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    if (!(await ctx.runMutation(internal.betaAccess.beginSync, {}))) return null
    try {
      const policy = await ctx.runQuery(internal.betaAccess.policy, {})
      if (!policy) return null
      const clerk = clerkClient()
      if (policy.enabled) {
        const allowed = new Set(policy.creatorEmails)
        let cursor: string | null = null
        while (true) {
          const page: {
            page: string[]
            isDone: boolean
            continueCursor: string
          } = await ctx.runQuery(internal.betaAccess.employeeEmails, {
            paginationOpts: { numItems: 100, cursor },
          })
          page.page.forEach((email) => allowed.add(email))
          if (page.isDone) break
          cursor = page.continueCursor
        }
        const existing: { id: string; identifier: string }[] = []
        for (let offset = 0; ; offset += 100) {
          const page =
            await clerk.allowlistIdentifiers.getAllowlistIdentifierList({
              limit: 100,
              offset,
            })
          existing.push(...page.data)
          if (offset + page.data.length >= page.totalCount) break
        }
        const present = new Set(
          existing.map((entry) => entry.identifier.toLowerCase())
        )
        for (const identifier of allowed) {
          if (!present.has(identifier)) {
            try {
              await clerk.allowlistIdentifiers.createAllowlistIdentifier({
                identifier,
                notify: false,
              })
            } catch (error) {
              // Duplicate additions from concurrent profile updates are harmless.
              if (!(
                typeof error === "object" &&
                error !== null &&
                "errors" in error &&
                Array.isArray(error.errors) &&
                error.errors.some(
                  (item: { code?: string }) =>
                    item.code === "form_identifier_exists"
                )
              ))
                throw error
            }
          }
        }
        for (const entry of existing) {
          if (!allowed.has(entry.identifier.toLowerCase())) {
            await clerk.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id)
          }
        }
      }
      await clerk.instance.updateRestrictions({ allowlist: policy.enabled })
      for (let offset = 0; ; offset += 100) {
        const page = await clerk.users.getUserList({ limit: 100, offset })
        for (const user of page.data) await syncUser(ctx, user.id, user)
        if (offset + page.data.length >= page.totalCount) break
      }
      return null
    } finally {
      await ctx.runMutation(internal.betaAccess.finishSync, {})
    }
  },
})
