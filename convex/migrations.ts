import { internalQuery } from "./_generated/server"

/**
 * Read-only rollout inspection. Run with:
 * bunx convex run migrations:inspectOrganizationMappings --prod
 *
 * Organization creation itself stays in the signed-in manager migration flow
 * because only Clerk can create the Organization and establish its first admin.
 */
export const inspectOrganizationMappings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const unmapped: Array<{
      hubId: string
      name: string
      slug: string
      ownerSubject: string
    }> = []
    for await (const hub of ctx.db.query("hubs")) {
      if (!hub.clerkOrganizationId) {
        unmapped.push({
          hubId: hub._id,
          name: hub.name,
          slug: hub.slug,
          ownerSubject: hub.ownerSubject,
        })
      }
      if (unmapped.length >= 100) break
    }
    return {
      complete: unmapped.length === 0,
      sampleUnmapped: unmapped,
      truncated: unmapped.length === 100,
    }
  },
})
