import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { v } from "convex/values"

import { query } from "./_generated/server"
import { requireHubPermission } from "./lib/access"
import { auditLogResultValidator } from "./lib/auditLogs"

export const list = query({
  args: {
    hubId: v.id("hubs"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(auditLogResultValidator),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_hubId_and_occurredAt", (q) => q.eq("hubId", args.hubId))
      .order("desc")
      .paginate(args.paginationOpts)
  },
})
