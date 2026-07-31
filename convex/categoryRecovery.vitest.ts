/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { RESERVATION_EVENT_TYPE_ID } from "../lib/categories"
import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "recovery-owner",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|recovery-owner",
  o: { id: "recovery-org", rol: "admin", slg: "recovery-workplace" },
}
const otherIdentity = {
  subject: "other-user",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|other-user",
  o: { id: "other-org", rol: "admin", slg: "other-workplace" },
}

async function createHub(t: ReturnType<typeof convexTest>) {
  return await t.withIdentity(ownerIdentity).mutation(api.hubs.create, {
    name: "Recovery workplace",
    slug: "recovery-workplace",
    accessMode: "restricted",
    joinCode: "ABCD-EFGH",
    privateToken: "private-token-that-is-at-least-thirty-two-characters",
    timeZone: "Europe/Tallinn",
    locale: "en",
  })
}

describe("category schema recovery", () => {
  test("restores Reservation when the required event type is missing", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    await t.run(async (ctx) => {
      const reservation = await ctx.db
        .query("categories")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", RESERVATION_EVENT_TYPE_ID)
        )
        .unique()
      if (!reservation) throw new Error("Missing reservation")
      await ctx.db.delete("categories", reservation._id)
    })

    const owner = t.withIdentity(ownerIdentity)
    await expect(
      owner.query(api.categoryRecovery.getStatus, { hubId })
    ).resolves.toMatchObject({ needed: true, missingReservation: true })
    await expect(
      owner.mutation(api.categoryRecovery.run, { hubId })
    ).resolves.toMatchObject({
      readyForStrictSchema: true,
      categoriesRepaired: 1,
      reservationCreated: true,
    })
    await expect(
      owner.query(api.categoryRecovery.getStatus, { hubId })
    ).resolves.toMatchObject({
      needed: false,
      readyForStrictSchema: true,
      missingReservation: false,
    })
  })

  test("repairs legacy rows and removes retired defaults", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const seeded = await t.run(async (ctx) => {
      const reservation = await ctx.db
        .query("categories")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", hubId).eq("slug", RESERVATION_EVENT_TYPE_ID)
        )
        .unique()
      if (!reservation) throw new Error("Missing reservation")
      await ctx.db.patch("categories", reservation._id, {
        systemLabelKey: "reservation",
      })
      const guideCategoryId = await ctx.db.insert("categories", {
        hubId,
        slug: "operations",
        label: "Operations",
        iconKey: "general",
        description: "Operational guides",
        order: 1,
      })
      const maintenanceId = await ctx.db.insert("categories", {
        hubId,
        slug: "event-maintenance",
        label: "Maintenance",
        iconKey: "general",
        description: "",
        order: 2,
        kind: "event",
        systemLabelKey: "maintenance",
      })
      const customTypeId = await ctx.db.insert("categories", {
        hubId,
        slug: "event-inventory",
        label: "Inventory",
        iconKey: "general",
        description: "",
        order: 3,
        kind: "event",
      })
      await ctx.db.insert("events", {
        hubId,
        slug: "legacy-maintenance",
        title: "Maintenance",
        description: "Legacy default",
        category: "Maintenance",
        start: "2026-08-01T10:00",
        end: "2026-08-01T11:00",
        location: "Office",
        notes: "",
        published: false,
      })
      await ctx.db.insert("events", {
        hubId,
        slug: "legacy-custom",
        title: "Inventory",
        description: "Custom type",
        category: "Inventory",
        start: "2026-08-02T10:00",
        end: "2026-08-02T11:00",
        location: "Stockroom",
        notes: "",
        published: false,
      })
      await ctx.db.insert("events", {
        hubId,
        slug: "current-retired-default",
        title: "Maintenance follow-up",
        description: "References a retired default",
        categoryId: maintenanceId,
        start: "2026-08-03T10:00",
        end: "2026-08-03T11:00",
        location: "Office",
        notes: "",
        published: false,
      })
      return {
        reservationId: reservation._id,
        guideCategoryId,
        maintenanceId,
        customTypeId,
      }
    })

    const owner = t.withIdentity(ownerIdentity)
    await expect(
      t.withIdentity(otherIdentity).query(api.categoryRecovery.getStatus, {
        hubId,
      })
    ).rejects.toThrow("unauthorized")
    const before = await owner.query(api.categoryRecovery.getStatus, { hubId })
    expect(before).toMatchObject({
      needed: true,
      readyForStrictSchema: false,
      blocked: false,
      categoriesNeedingKindRepair: 1,
      categoriesWithSystemLabel: 2,
      eventsNeedingCategoryRepair: 3,
      retiredDefaultEventTypes: 1,
      missingReservation: false,
    })

    await expect(
      t
        .withIdentity(otherIdentity)
        .mutation(api.categoryRecovery.run, { hubId })
    ).rejects.toThrow("unauthorized")
    await expect(
      owner.mutation(api.categoryRecovery.run, { hubId })
    ).resolves.toMatchObject({
      readyForStrictSchema: true,
      categoriesRepaired: 2,
      eventsRepaired: 3,
      defaultEventTypesRemoved: 1,
      reservationCreated: false,
    })

    const recovered = await t.run(async (ctx) => {
      const categories = await ctx.db
        .query("categories")
        .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hubId))
        .take(20)
      const events = await ctx.db
        .query("events")
        .withIndex("by_hubId_and_start", (q) => q.eq("hubId", hubId))
        .take(20)
      return { categories, events }
    })
    expect(recovered.categories).not.toContainEqual(
      expect.objectContaining({ _id: seeded.maintenanceId })
    )
    expect(recovered.categories).toContainEqual(
      expect.objectContaining({
        _id: seeded.guideCategoryId,
        kind: "guide",
      })
    )
    expect(recovered.categories).toContainEqual(
      expect.objectContaining({
        _id: seeded.customTypeId,
        kind: "event",
      })
    )
    for (const category of recovered.categories) {
      expect(category.kind).toBeDefined()
      expect(category.systemLabelKey).toBeUndefined()
    }
    expect(
      recovered.events.find((event) => event.slug === "legacy-maintenance")
        ?.categoryId
    ).toBe(seeded.reservationId)
    expect(
      recovered.events.find((event) => event.slug === "legacy-custom")
        ?.categoryId
    ).toBe(seeded.customTypeId)
    expect(
      recovered.events.find((event) => event.slug === "current-retired-default")
        ?.categoryId
    ).toBe(seeded.reservationId)
    for (const event of recovered.events) {
      expect(event.category).toBeUndefined()
      expect(event.categoryId).toBeDefined()
    }

    await expect(
      owner.query(api.categoryRecovery.getStatus, { hubId })
    ).resolves.toMatchObject({
      needed: false,
      readyForStrictSchema: true,
    })
    await expect(
      owner.mutation(api.categoryRecovery.run, { hubId })
    ).resolves.toMatchObject({
      readyForStrictSchema: true,
      categoriesRepaired: 0,
      eventsRepaired: 0,
      defaultEventTypesRemoved: 0,
      reservationCreated: false,
    })
  })
})
