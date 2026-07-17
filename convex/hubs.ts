import { v } from "convex/values"

import { createSeedState } from "../lib/operations"
import type { Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx } from "./_generated/server"
import {
  canReadPublishedHub,
  getOwnedHub,
  hashCredential,
  normalizeJoinCode,
  requireIdentity,
  requireOwnedHub,
} from "./lib/access"
import { buildSnapshot } from "./lib/snapshot"

const accessModeValidator = v.union(
  v.literal("public"),
  v.literal("restricted")
)

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

async function availableSlug(ctx: MutationCtx, requested: string) {
  const base = slugify(requested) || "operations-hub"
  let candidate = base
  let suffix = 2
  while (
    await ctx.db
      .query("hubs")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique()
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

async function seedHub(ctx: MutationCtx, hubId: Id<"hubs">) {
  const seed = createSeedState()
  const categoryIds = new Map<string, Id<"categories">>()
  for (const [order, category] of seed.categories.entries()) {
    const categoryId = await ctx.db.insert("categories", {
      hubId,
      slug: category.id,
      label: category.label,
      iconKey: category.iconKey,
      description: category.description,
      order,
    })
    categoryIds.set(category.id, categoryId)
  }

  const guideIds = new Map<string, Id<"guides">>()
  for (const guide of seed.guides) {
    const categoryId = categoryIds.get(guide.category)
    if (!categoryId) continue
    const guideId = await ctx.db.insert("guides", {
      hubId,
      slug: guide.id,
      title: guide.title,
      description: guide.description,
      categoryId,
      duration: guide.duration,
      updatedLabel: guide.updated,
      featured: Boolean(guide.featured),
      published: Boolean(guide.published),
      keywords: guide.keywords ?? [],
      content: guide.content,
    })
    guideIds.set(guide.id, guideId)
  }

  const eventIds = new Map<string, Id<"events">>()
  for (const event of seed.events) {
    const eventId = await ctx.db.insert("events", {
      hubId,
      slug: event.id,
      title: event.title,
      description: event.description,
      category: event.category,
      start: event.start,
      end: event.end,
      location: event.location,
      owner: event.owner,
      notes: event.notes,
      published: event.published,
    })
    eventIds.set(event.id, eventId)
    for (const guideSlug of event.guideIds) {
      const guideId = guideIds.get(guideSlug)
      if (guideId) {
        await ctx.db.insert("eventGuides", { hubId, eventId, guideId })
      }
    }
  }

  for (const announcement of seed.announcements) {
    await ctx.db.insert("announcements", {
      hubId,
      slug: announcement.id,
      title: announcement.title,
      content: announcement.content,
      publishedAt: announcement.publishedAt,
      expiresAt: announcement.expiresAt,
      priority: announcement.priority,
      pinned: announcement.pinned,
      published: announcement.published,
      guideId: announcement.guideId
        ? guideIds.get(announcement.guideId)
        : undefined,
      eventId: announcement.eventId
        ? eventIds.get(announcement.eventId)
        : undefined,
    })
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    accessMode: accessModeValidator,
    joinCode: v.string(),
    privateToken: v.string(),
    seedDemoContent: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const existing = await getOwnedHub(ctx)
    if (existing)
      return { hubId: existing._id, slug: existing.slug, created: false }

    const name = args.name.trim()
    if (name.length < 2 || name.length > 80) {
      throw new Error("Hub name must be between 2 and 80 characters")
    }
    if (normalizeJoinCode(args.joinCode).length < 8) {
      throw new Error("Join code is too short")
    }
    if (args.privateToken.length < 32) {
      throw new Error("Private link credential is too short")
    }

    const slug = await availableSlug(ctx, args.slug)
    const now = Date.now()
    const hubId = await ctx.db.insert("hubs", {
      name,
      slug,
      ownerSubject: identity.subject,
      ownerTokenIdentifier: identity.tokenIdentifier,
      accessMode: args.accessMode,
      joinCodeHash: hashCredential(normalizeJoinCode(args.joinCode)),
      privateTokenHash: hashCredential(args.privateToken),
      credentialVersion: 1,
      createdAt: now,
      updatedAt: now,
    })

    if (args.seedDemoContent) await seedHub(ctx, hubId)
    return { hubId, slug, created: true }
  },
})

export const getOwnedSnapshot = query({
  args: { nowDate: v.string() },
  handler: async (ctx, args) => {
    const hub = await getOwnedHub(ctx)
    if (!hub) return { kind: "none" as const }
    return {
      kind: "ready" as const,
      ...(await buildSnapshot(ctx, hub, {
        includeDrafts: true,
        nowDate: args.nowDate,
      })),
    }
  },
})

export const getPublicSnapshot = query({
  args: {
    slug: v.string(),
    credential: v.optional(v.string()),
    nowDate: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!hub) return { kind: "not-found" as const }
    if (!(await canReadPublishedHub(ctx, hub, args.credential))) {
      return {
        kind: "restricted" as const,
        hub: {
          id: hub._id,
          name: hub.name,
          slug: hub.slug,
          accessMode: hub.accessMode,
          credentialVersion: hub.credentialVersion,
        },
      }
    }
    return {
      kind: "ready" as const,
      ...(await buildSnapshot(ctx, hub, {
        includeDrafts: false,
        nowDate: args.nowDate,
      })),
    }
  },
})

export const setAccessMode = mutation({
  args: { hubId: v.id("hubs"), accessMode: accessModeValidator },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    await ctx.db.patch("hubs", args.hubId, {
      accessMode: args.accessMode,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const rotateCredentials = mutation({
  args: {
    hubId: v.id("hubs"),
    joinCode: v.string(),
    privateToken: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await requireOwnedHub(ctx, args.hubId)
    if (normalizeJoinCode(args.joinCode).length < 8) {
      throw new Error("Join code is too short")
    }
    if (args.privateToken.length < 32) {
      throw new Error("Private link credential is too short")
    }
    const credentialVersion = hub.credentialVersion + 1
    await ctx.db.patch("hubs", hub._id, {
      joinCodeHash: hashCredential(normalizeJoinCode(args.joinCode)),
      privateTokenHash: hashCredential(args.privateToken),
      credentialVersion,
      updatedAt: Date.now(),
    })
    return { credentialVersion }
  },
})
