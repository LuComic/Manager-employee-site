import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"

export const MAX_SNAPSHOT_EVENTS = 1_000

function byStart(a: Doc<"events">, b: Doc<"events">) {
  return a.start.localeCompare(b.start)
}

export async function loadPublishedEvents(
  ctx: QueryCtx,
  hubId: Id<"hubs">,
  includePrivateEvents: boolean
) {
  if (includePrivateEvents) {
    return await ctx.db
      .query("events")
      .withIndex("by_hubId_and_published", (q) =>
        q.eq("hubId", hubId).eq("published", true)
      )
      .take(MAX_SNAPSHOT_EVENTS)
  }

  const [explicitlyPublic, legacyPublic] = await Promise.all([
    ctx.db
      .query("events")
      .withIndex("by_hubId_and_published_and_isPrivate_and_start", (q) =>
        q.eq("hubId", hubId).eq("published", true).eq("isPrivate", false)
      )
      .take(MAX_SNAPSHOT_EVENTS),
    ctx.db
      .query("events")
      .withIndex("by_hubId_and_published_and_isPrivate_and_start", (q) =>
        q.eq("hubId", hubId).eq("published", true).eq("isPrivate", undefined)
      )
      .take(MAX_SNAPSHOT_EVENTS),
  ])
  return [...explicitlyPublic, ...legacyPublic]
    .sort(byStart)
    .slice(0, MAX_SNAPSHOT_EVENTS)
}
