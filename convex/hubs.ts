import { v } from "convex/values"

import { createSeedState } from "../lib/operations"
import { commonQuestions } from "../lib/knowledge-base"
import {
  defaultTodaySections,
  normalizeTodaySections,
} from "../lib/today-sections"
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
const todaySectionKeyValidator = v.union(
  v.literal("welcome"),
  v.literal("quick-links"),
  v.literal("happening-today"),
  v.literal("current-announcements"),
  v.literal("coming-next"),
  v.literal("useful-guides")
)

const defaultDescription =
  "Current updates, important times, and practical guides for each shift."

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

  for (const [order, faq] of commonQuestions.entries()) {
    await ctx.db.insert("faqs", {
      hubId,
      slug: slugify(faq.question),
      question: faq.question,
      answer: faq.answer,
      order,
      published: true,
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
    timeZone: v.string(),
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
    const timeZone = validateTimeZone(args.timeZone)
    const hubId = await ctx.db.insert("hubs", {
      name,
      slug,
      description: defaultDescription,
      address: "",
      timeZone,
      contactName: "shift lead",
      contactEmail: "",
      contactPhone: "",
      todaySections: defaultTodaySections.map((section) => ({ ...section })),
      contentVersion: 1,
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

function optional(value: string, max: number) {
  const clean = value.trim()
  if (clean.length > max) throw new Error("A hub detail is too long")
  return clean
}

function validateTimeZone(value: string) {
  const clean = value.trim()
  try {
    new Intl.DateTimeFormat("en", { timeZone: clean }).format()
  } catch {
    throw new Error("Choose a valid time zone")
  }
  return clean
}

export const ensureManagedContent = mutation({
  args: { hubId: v.id("hubs") },
  handler: async (ctx, args) => {
    const hub = await requireOwnedHub(ctx, args.hubId)
    if ((hub.contentVersion ?? 0) >= 1) return null

    const existingFaq = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hub._id))
      .first()
    if (!existingFaq) {
      for (const [order, faq] of commonQuestions.entries()) {
        await ctx.db.insert("faqs", {
          hubId: hub._id,
          slug: slugify(faq.question),
          question: faq.question,
          answer: faq.answer,
          order,
          published: true,
        })
      }
    }

    await ctx.db.patch("hubs", hub._id, {
      description: hub.description ?? defaultDescription,
      address: hub.address ?? "",
      timeZone: hub.timeZone ?? "Europe/Tallinn",
      contactName: hub.contactName ?? "shift lead",
      contactEmail: hub.contactEmail ?? "",
      contactPhone: hub.contactPhone ?? "",
      contentVersion: 1,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const updateSettings = mutation({
  args: {
    hubId: v.id("hubs"),
    name: v.string(),
    description: v.string(),
    address: v.string(),
    timeZone: v.string(),
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const name = args.name.trim()
    if (name.length < 2 || name.length > 80)
      throw new Error("Hub name must be between 2 and 80 characters")
    const contactEmail = optional(args.contactEmail, 200)
    if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail))
      throw new Error("Enter a valid contact email")

    await ctx.db.patch("hubs", args.hubId, {
      name,
      description: optional(args.description, 500),
      address: optional(args.address, 500),
      timeZone: validateTimeZone(args.timeZone),
      contactName: optional(args.contactName, 100) || "shift lead",
      contactEmail,
      contactPhone: optional(args.contactPhone, 80),
      updatedAt: Date.now(),
    })
    return null
  },
})

export const moveTodaySection = mutation({
  args: {
    hubId: v.id("hubs"),
    key: todaySectionKeyValidator,
    direction: v.union(v.literal(-1), v.literal(1)),
  },
  handler: async (ctx, args) => {
    const hub = await requireOwnedHub(ctx, args.hubId)
    const sections = normalizeTodaySections(hub.todaySections)
    const index = sections.findIndex((section) => section.key === args.key)
    const target = index + args.direction
    if (index < 0 || target < 0 || target >= sections.length) return null
    const current = sections[index]
    sections[index] = sections[target]
    sections[target] = current
    await ctx.db.patch("hubs", hub._id, {
      todaySections: sections,
      updatedAt: Date.now(),
    })
    return null
  },
})

export const setTodaySectionVisibility = mutation({
  args: {
    hubId: v.id("hubs"),
    key: todaySectionKeyValidator,
    visible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const hub = await requireOwnedHub(ctx, args.hubId)
    const todaySections = normalizeTodaySections(hub.todaySections).map(
      (section) =>
        section.key === args.key
          ? { ...section, visible: args.visible }
          : section
    )
    await ctx.db.patch("hubs", hub._id, {
      todaySections,
      updatedAt: Date.now(),
    })
    return null
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
