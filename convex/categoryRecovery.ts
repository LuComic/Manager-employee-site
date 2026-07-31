import { v } from "convex/values"

import { RESERVATION_EVENT_TYPE_ID } from "../lib/categories"
import type { Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { requireHubPermission } from "./lib/access"

const RECOVERY_LIMIT = 500
const retiredDefaultEventTypeIds = new Set([
  "event-training",
  "event-maintenance",
  "event-inspection",
  "event-opening-hours",
])

const statusValidator = v.object({
  needed: v.boolean(),
  readyForStrictSchema: v.boolean(),
  blocked: v.boolean(),
  categoriesNeedingKindRepair: v.number(),
  categoriesWithSystemLabel: v.number(),
  eventsNeedingCategoryRepair: v.number(),
  retiredDefaultEventTypes: v.number(),
  missingReservation: v.boolean(),
})

const resultValidator = v.object({
  readyForStrictSchema: v.boolean(),
  categoriesRepaired: v.number(),
  eventsRepaired: v.number(),
  defaultEventTypesRemoved: v.number(),
  reservationCreated: v.boolean(),
})

type RecoveryCtx = QueryCtx | MutationCtx

async function loadRecoveryRows(ctx: RecoveryCtx, hubId: Id<"hubs">) {
  const [categories, events] = await Promise.all([
    ctx.db
      .query("categories")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hubId))
      .take(RECOVERY_LIMIT + 1),
    ctx.db
      .query("events")
      .withIndex("by_hubId_and_start", (q) => q.eq("hubId", hubId))
      .take(RECOVERY_LIMIT + 1),
  ])
  return { categories, events }
}

function recoveryStatus(rows: Awaited<ReturnType<typeof loadRecoveryRows>>) {
  const blocked =
    rows.categories.length > RECOVERY_LIMIT ||
    rows.events.length > RECOVERY_LIMIT
  const categories = rows.categories.slice(0, RECOVERY_LIMIT)
  const events = rows.events.slice(0, RECOVERY_LIMIT)
  const reservation = categories.find(
    (category) => category.slug === RESERVATION_EVENT_TYPE_ID
  )
  const eventCategoryIds = new Set(
    categories
      .filter((category) => category.kind === "event")
      .map((category) => category._id)
  )
  const retiredIds = new Set(
    categories
      .filter((category) => retiredDefaultEventTypeIds.has(category.slug))
      .map((category) => category._id)
  )
  const categoriesNeedingKindRepair = categories.filter(
    (category) =>
      category.kind === undefined ||
      (category._id === reservation?._id && category.kind !== "event")
  ).length
  const categoriesWithSystemLabel = categories.filter(
    (category) => category.systemLabelKey !== undefined
  ).length
  const retiredDefaultEventTypes = retiredIds.size
  const eventsNeedingCategoryRepair = events.filter(
    (event) =>
      event.category !== undefined ||
      event.categoryId === undefined ||
      retiredIds.has(event.categoryId) ||
      !eventCategoryIds.has(event.categoryId)
  ).length
  const missingReservation = !reservation
  const needed =
    blocked ||
    missingReservation ||
    categoriesNeedingKindRepair > 0 ||
    categoriesWithSystemLabel > 0 ||
    retiredDefaultEventTypes > 0 ||
    eventsNeedingCategoryRepair > 0
  return {
    needed,
    readyForStrictSchema: !needed,
    blocked,
    categoriesNeedingKindRepair,
    categoriesWithSystemLabel,
    eventsNeedingCategoryRepair,
    retiredDefaultEventTypes,
    missingReservation,
  }
}

export const getStatus = query({
  args: { hubId: v.id("hubs") },
  returns: statusValidator,
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "owner")
    return recoveryStatus(await loadRecoveryRows(ctx, args.hubId))
  },
})

export const run = mutation({
  args: { hubId: v.id("hubs") },
  returns: resultValidator,
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "owner")
    const rows = await loadRecoveryRows(ctx, args.hubId)
    if (
      rows.categories.length > RECOVERY_LIMIT ||
      rows.events.length > RECOVERY_LIMIT
    ) {
      throw new Error("categoryRecoveryTooMuchData")
    }

    let reservation = rows.categories.find(
      (category) => category.slug === RESERVATION_EVENT_TYPE_ID
    )
    let reservationCreated = false
    if (!reservation) {
      const reservationId = await ctx.db.insert("categories", {
        hubId: args.hubId,
        slug: RESERVATION_EVENT_TYPE_ID,
        label: "Reservation",
        iconKey: "general",
        description: "",
        order: 0,
        kind: "event",
      })
      const createdReservation = await ctx.db.get("categories", reservationId)
      if (!createdReservation) {
        throw new Error("categoryRecoveryReservationFailed")
      }
      reservation = createdReservation
      reservationCreated = true
    }
    if (!reservation) throw new Error("categoryRecoveryReservationFailed")

    const retiredIds = new Set(
      rows.categories
        .filter((category) => retiredDefaultEventTypeIds.has(category.slug))
        .map((category) => category._id)
    )
    const retainedEventTypes = [
      reservation,
      ...rows.categories.filter(
        (category) =>
          category._id !== reservation._id &&
          category.kind === "event" &&
          !retiredIds.has(category._id)
      ),
    ]
    const retainedEventTypeIds = new Set(
      retainedEventTypes.map((category) => category._id)
    )
    const retainedEventTypeByValue = new Map<string, Id<"categories">>()
    for (const category of retainedEventTypes) {
      for (const value of [
        category.slug,
        category.label,
        category.systemLabelKey,
      ]) {
        if (value)
          retainedEventTypeByValue.set(value.trim().toLowerCase(), category._id)
      }
    }

    let categoriesRepaired = reservationCreated ? 1 : 0
    for (const category of rows.categories) {
      if (retiredIds.has(category._id)) continue
      const kind =
        category._id === reservation._id ? "event" : (category.kind ?? "guide")
      if (category.kind === kind && category.systemLabelKey === undefined) {
        continue
      }
      await ctx.db.replace("categories", category._id, {
        hubId: category.hubId,
        slug: category.slug,
        label: category.label,
        iconKey: category.iconKey,
        description: category.description,
        order: category.order,
        kind,
      })
      categoriesRepaired += 1
    }

    let eventsRepaired = 0
    for (const event of rows.events) {
      const currentCategoryIsRetained =
        event.categoryId !== undefined &&
        retainedEventTypeIds.has(event.categoryId)
      const legacyCategoryId = event.category
        ? retainedEventTypeByValue.get(event.category.trim().toLowerCase())
        : undefined
      const categoryId = currentCategoryIsRetained
        ? event.categoryId
        : (legacyCategoryId ?? reservation._id)
      if (event.category === undefined && event.categoryId === categoryId) {
        continue
      }
      await ctx.db.patch("events", event._id, {
        categoryId,
        category: undefined,
      })
      eventsRepaired += 1
    }

    let defaultEventTypesRemoved = 0
    for (const category of rows.categories) {
      if (!retiredIds.has(category._id)) continue
      await ctx.db.delete("categories", category._id)
      defaultEventTypesRemoved += 1
    }

    return {
      readyForStrictSchema: true,
      categoriesRepaired,
      eventsRepaired,
      defaultEventTypesRemoved,
      reservationCreated,
    }
  },
})
