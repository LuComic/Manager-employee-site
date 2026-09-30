import type { QueryCtx, MutationCtx } from "../_generated/server"

type ReadCtx = QueryCtx | MutationCtx

export async function betaPolicy(ctx: ReadCtx) {
  return await ctx.db
    .query("betaPolicy")
    .withIndex("by_key", (q) => q.eq("key", "signup"))
    .unique()
}

export async function canCreateOrganization(ctx: ReadCtx, clerkUserId: string) {
  const policy = await betaPolicy(ctx)
  if (!policy?.enabled) return true
  const account = await ctx.db
    .query("accountEmails")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique()
  return (
    account?.verifiedEmails.some((email) =>
      policy.creatorEmails.includes(email)
    ) ?? false
  )
}
