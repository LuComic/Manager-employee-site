import { v } from "convex/values"

import { query } from "./_generated/server"
import { requireHubPermission } from "./lib/access"

const scheduleValidator = v.object({
  id: v.id("events"),
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
    const schedules = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_source_and_start", (q) =>
        q.eq("hubId", args.hubId).eq("source", "deputy")
      )
      .take(500)
    return schedules
      .filter((schedule) => !schedule.sourceDeleted && !schedule.managerDeleted)
      .map((schedule) => ({
        id: schedule._id,
        employeeName: schedule.title,
        start: schedule.start,
        end: schedule.end,
        area: schedule.location,
        published: schedule.published,
      }))
  },
})
