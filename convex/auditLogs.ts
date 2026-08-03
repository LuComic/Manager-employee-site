import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server"
import { v } from "convex/values"

import { query } from "./_generated/server"
import { requireHubPermission } from "./lib/access"

const auditLogValidator = v.object({
  _id: v.id("auditLogs"),
  _creationTime: v.number(),
  hubId: v.id("hubs"),
  actorId: v.string(),
  actorName: v.string(),
  action: v.union(
    v.literal("created"),
    v.literal("edited"),
    v.literal("deleted"),
    v.literal("drafted")
  ),
  entityType: v.union(
    v.literal("announcement"),
    v.literal("attachment"),
    v.literal("category"),
    v.literal("document"),
    v.literal("employee"),
    v.literal("event"),
    v.literal("faq"),
    v.literal("guide"),
    v.literal("helpRequest"),
    v.literal("workplace")
  ),
  entityId: v.optional(v.string()),
  entityTitle: v.string(),
  occurredAt: v.number(),
})

export const list = query({
  args: {
    hubId: v.id("hubs"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(auditLogValidator),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_hubId_and_occurredAt", (q) => q.eq("hubId", args.hubId))
      .order("desc")
      .paginate(args.paginationOpts)
  },
})
