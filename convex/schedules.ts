import { v } from "convex/values"

import { query } from "./_generated/server"
import { requireHubPermission } from "./lib/access"

const scheduleValidator = v.object({
  id: v.id("events"),
  slug: v.string(),
  employeeId: v.optional(v.string()),
  employeeName: v.string(),
  start: v.string(),
  end: v.string(),
  area: v.string(),
  published: v.boolean(),
})

export const listForManager = query({
  args: { hubId: v.id("hubs") },
  returns: v.array(scheduleValidator),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    // This temporary bounded fallback keeps schedule reads live while the
    // more selective existing-table index backfills asynchronously.
    const schedules = (
      await ctx.db
        .query("events")
        .withIndex("by_hubId_and_source_and_start", (q) =>
          q.eq("hubId", args.hubId).eq("source", "deputy")
        )
        .order("desc")
        .take(1_000)
    )
      .filter((schedule) => !schedule.sourceDeleted && !schedule.managerDeleted)
      .sort((a, b) => b.start.localeCompare(a.start))
      .slice(0, 500)
    return schedules
      .map((schedule) => ({
        id: schedule._id,
        slug: schedule.slug,
        employeeId: schedule.sourceEmployeeId,
        employeeName: schedule.title,
        start: schedule.start,
        end: schedule.end,
        area: schedule.location,
        published: schedule.published,
      }))
      .sort((a, b) => a.start.localeCompare(b.start))
  },
})
