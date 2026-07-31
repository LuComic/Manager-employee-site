import { v } from "convex/values"

import { defaultEventTypeDefinitions } from "../../lib/categories"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export const categoryKindValidator = v.union(
  v.literal("guide"),
  v.literal("event")
)

export function categoryKind(category: Doc<"categories">) {
  return category.kind ?? "guide"
}

export async function ensureDefaultEventTypes(
  ctx: MutationCtx,
  hubId: Id<"hubs">
) {
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hubId))
    .take(500)
  if (categories.some((category) => categoryKind(category) === "event")) {
    return
  }

  for (const [index, definition] of defaultEventTypeDefinitions.entries()) {
    await ctx.db.insert("categories", {
      hubId,
      slug: definition.id,
      label: definition.label,
      iconKey: "general",
      description: "",
      order: categories.length + index,
      kind: "event",
      systemLabelKey: definition.messageKey,
    })
  }
}

export async function resolveEventTypeId(
  ctx: MutationCtx,
  hubId: Id<"hubs">,
  value: string
) {
  await ensureDefaultEventTypes(ctx, hubId)
  const categories = await ctx.db
    .query("categories")
    .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hubId))
    .take(500)
  const eventTypes = categories.filter(
    (category) => categoryKind(category) === "event"
  )
  const exact = eventTypes.find((category) => category.slug === value)
  if (exact) return exact.slug

  const definition = defaultEventTypeDefinitions.find(
    (item) =>
      item.id === value ||
      item.legacyValue.toLowerCase() === value.trim().toLowerCase()
  )
  const migrated = definition
    ? eventTypes.find(
        (category) =>
          category.slug === definition.id ||
          category.systemLabelKey === definition.messageKey
      )
    : undefined
  if (!migrated) throw new Error("eventCategoryNotFound")
  return migrated.slug
}

export function storedEventCategoryValues(category: Doc<"categories">) {
  const definition = defaultEventTypeDefinitions.find(
    (item) => item.id === category.slug
  )
  return new Set(
    definition ? [category.slug, definition.legacyValue] : [category.slug]
  )
}
