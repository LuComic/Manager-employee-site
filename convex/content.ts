import { v } from "convex/values"

import { mutation, query } from "./_generated/server"
import { canReadPublishedHub, requireOwnedHub } from "./lib/access"

const richTextDocument = v.object({
  type: v.literal("doc"),
  content: v.optional(v.array(v.any())),
})

const eventCategory = v.union(
  v.literal("Reservation"),
  v.literal("Training"),
  v.literal("Promotion"),
  v.literal("Delivery"),
  v.literal("Maintenance"),
  v.literal("Inspection"),
  v.literal("Opening hours")
)

function required(value: string, label: string, max = 500) {
  const clean = value.trim()
  if (!clean) throw new Error(`${label} is required`)
  if (clean.length > max) throw new Error(`${label} is too long`)
  return clean
}

export const saveCategory = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    label: v.string(),
    iconKey: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    const value = {
      label: required(args.label, "Category name", 80),
      iconKey: required(args.iconKey, "Category icon", 40),
      description: required(args.description, "Category description", 300),
    }
    if (existing) {
      await ctx.db.patch("categories", existing._id, value)
      return existing.slug
    }
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
      .take(500)
    await ctx.db.insert("categories", {
      hubId: args.hubId,
      slug: required(args.slug, "Category slug", 80),
      order: categories.length,
      ...value,
    })
    return args.slug
  },
})

export const moveCategory = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    direction: v.union(v.literal(-1), v.literal(1)),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
      .take(500)
    const index = categories.findIndex(
      (category) => category.slug === args.slug
    )
    const target = index + args.direction
    if (index < 0 || target < 0 || target >= categories.length) return null
    await ctx.db.patch("categories", categories[index]._id, {
      order: categories[target].order,
    })
    await ctx.db.patch("categories", categories[target]._id, {
      order: categories[index].order,
    })
    return null
  },
})

export const deleteCategory = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const category = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!category) return null
    const guide = await ctx.db
      .query("guides")
      .withIndex("by_hubId_and_published", (q) => q.eq("hubId", args.hubId))
      .filter((q) => q.eq(q.field("categoryId"), category._id))
      .first()
    if (guide) throw new Error("Reassign guides before deleting this category")
    await ctx.db.delete("categories", category._id)
    return null
  },
})

export const saveGuide = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    categorySlug: v.string(),
    duration: v.string(),
    featured: v.boolean(),
    published: v.boolean(),
    keywords: v.array(v.string()),
    content: richTextDocument,
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const category = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.categorySlug)
      )
      .unique()
    if (!category) throw new Error("Guide category not found")
    const existing = await ctx.db
      .query("guides")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    const value = {
      title: required(args.title, "Guide title", 140),
      description: required(args.description, "Guide description", 500),
      categoryId: category._id,
      duration: required(args.duration, "Reading time", 40),
      updatedLabel: "Updated just now",
      featured: args.featured,
      published: args.published,
      keywords: args.keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 40),
      content: args.content,
    }
    if (existing) await ctx.db.patch("guides", existing._id, value)
    else {
      await ctx.db.insert("guides", {
        hubId: args.hubId,
        slug: required(args.slug, "Guide slug", 100),
        ...value,
      })
    }
    return args.slug
  },
})

export const deleteGuide = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const guide = await ctx.db
      .query("guides")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!guide) return null
    const [relations, announcements] = await Promise.all([
      ctx.db
        .query("eventGuides")
        .withIndex("by_guideId", (q) => q.eq("guideId", guide._id))
        .take(1000),
      ctx.db
        .query("announcements")
        .withIndex("by_hubId_and_published", (q) => q.eq("hubId", args.hubId))
        .filter((q) => q.eq(q.field("guideId"), guide._id))
        .take(500),
    ])
    for (const relation of relations)
      await ctx.db.delete("eventGuides", relation._id)
    for (const announcement of announcements) {
      await ctx.db.patch("announcements", announcement._id, {
        guideId: undefined,
      })
    }
    await ctx.db.delete("guides", guide._id)
    return null
  },
})

export const saveEvent = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    category: eventCategory,
    start: v.string(),
    end: v.string(),
    location: v.string(),
    owner: v.string(),
    notes: v.string(),
    published: v.boolean(),
    guideSlugs: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    if (args.end <= args.start)
      throw new Error("Event end must be after its start")
    const existing = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    const value = {
      title: required(args.title, "Event title", 140),
      description: required(args.description, "Event description", 500),
      category: args.category,
      start: required(args.start, "Event start", 40),
      end: required(args.end, "Event end", 40),
      location: required(args.location, "Event location", 140),
      owner: required(args.owner, "Responsible person", 100),
      notes: args.notes.trim().slice(0, 4000),
      published: args.published,
    }
    const eventId = existing
      ? (await ctx.db.patch("events", existing._id, value), existing._id)
      : await ctx.db.insert("events", {
          hubId: args.hubId,
          slug: required(args.slug, "Event slug", 100),
          ...value,
        })

    const oldRelations = await ctx.db
      .query("eventGuides")
      .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
      .take(1000)
    for (const relation of oldRelations)
      await ctx.db.delete("eventGuides", relation._id)
    for (const guideSlug of [...new Set(args.guideSlugs)].slice(0, 100)) {
      const guide = await ctx.db
        .query("guides")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", args.hubId).eq("slug", guideSlug)
        )
        .unique()
      if (guide)
        await ctx.db.insert("eventGuides", {
          hubId: args.hubId,
          eventId,
          guideId: guide._id,
        })
    }
    return args.slug
  },
})

export const deleteEvent = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const event = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!event) return null
    const [relations, attachments, announcements] = await Promise.all([
      ctx.db
        .query("eventGuides")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(1000),
      ctx.db
        .query("attachments")
        .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
        .take(1000),
      ctx.db
        .query("announcements")
        .withIndex("by_hubId_and_published", (q) => q.eq("hubId", args.hubId))
        .filter((q) => q.eq(q.field("eventId"), event._id))
        .take(500),
    ])
    for (const relation of relations)
      await ctx.db.delete("eventGuides", relation._id)
    for (const attachment of attachments) {
      await ctx.storage.delete(attachment.storageId)
      await ctx.db.delete("attachments", attachment._id)
    }
    for (const announcement of announcements) {
      await ctx.db.patch("announcements", announcement._id, {
        eventId: undefined,
      })
    }
    await ctx.db.delete("events", event._id)
    return null
  },
})

export const saveAnnouncement = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    content: richTextDocument,
    publishedAt: v.string(),
    expiresAt: v.string(),
    priority: v.union(
      v.literal("Normal"),
      v.literal("Important"),
      v.literal("Urgent")
    ),
    pinned: v.boolean(),
    published: v.boolean(),
    guideSlug: v.optional(v.string()),
    eventSlug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    if (args.expiresAt < args.publishedAt)
      throw new Error("Expiry must be on or after publish date")
    const guide = args.guideSlug
      ? await ctx.db
          .query("guides")
          .withIndex("by_hubId_and_slug", (q) =>
            q.eq("hubId", args.hubId).eq("slug", args.guideSlug!)
          )
          .unique()
      : null
    const event = args.eventSlug
      ? await ctx.db
          .query("events")
          .withIndex("by_hubId_and_slug", (q) =>
            q.eq("hubId", args.hubId).eq("slug", args.eventSlug!)
          )
          .unique()
      : null
    const existing = await ctx.db
      .query("announcements")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    const value = {
      title: required(args.title, "Announcement title", 140),
      content: args.content,
      publishedAt: required(args.publishedAt, "Publish date", 10),
      expiresAt: required(args.expiresAt, "Expiry date", 10),
      priority: args.priority,
      pinned: args.pinned,
      published: args.published,
      guideId: guide?._id,
      eventId: event?._id,
    }
    if (existing) await ctx.db.patch("announcements", existing._id, value)
    else
      await ctx.db.insert("announcements", {
        hubId: args.hubId,
        slug: required(args.slug, "Announcement slug", 100),
        ...value,
      })
    return args.slug
  },
})

export const deleteAnnouncement = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const announcement = await ctx.db
      .query("announcements")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (announcement) await ctx.db.delete("announcements", announcement._id)
    return null
  },
})

export const saveFaq = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    question: v.string(),
    answer: v.string(),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const existing = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    const value = {
      question: required(args.question, "Question", 300),
      answer: required(args.answer, "Answer", 4000),
      published: args.published,
    }
    if (existing) {
      await ctx.db.patch("faqs", existing._id, value)
      return existing.slug
    }
    const faqs = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
      .take(500)
    await ctx.db.insert("faqs", {
      hubId: args.hubId,
      slug: required(args.slug, "Question slug", 120),
      order: faqs.length,
      ...value,
    })
    return args.slug
  },
})

export const moveFaq = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    direction: v.union(v.literal(-1), v.literal(1)),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const faqs = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
      .take(500)
    const index = faqs.findIndex((faq) => faq.slug === args.slug)
    const target = index + args.direction
    if (index < 0 || target < 0 || target >= faqs.length) return null
    await ctx.db.patch("faqs", faqs[index]._id, { order: faqs[target].order })
    await ctx.db.patch("faqs", faqs[target]._id, { order: faqs[index].order })
    return null
  },
})

export const deleteFaq = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const faq = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (faq) await ctx.db.delete("faqs", faq._id)
    return null
  },
})

export const submitHelpRequest = mutation({
  args: {
    hubSlug: v.string(),
    credential: v.optional(v.string()),
    topic: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_slug", (q) => q.eq("slug", args.hubSlug))
      .unique()
    if (!hub || !(await canReadPublishedHub(ctx, hub, args.credential)))
      throw new Error("Hub access required")
    await ctx.db.insert("helpRequests", {
      hubId: hub._id,
      topic: required(args.topic, "Topic", 140),
      message: required(args.message, "Question", 2000),
      submittedAt: Date.now(),
      status: "open",
    })
    return null
  },
})

export const listHelpRequests = query({
  args: { hubId: v.id("hubs") },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const requests = await ctx.db
      .query("helpRequests")
      .withIndex("by_hubId_and_submittedAt", (q) => q.eq("hubId", args.hubId))
      .order("desc")
      .take(500)
    return requests.map((request) => ({
      id: request._id,
      topic: request.topic,
      message: request.message,
      submittedAt: request.submittedAt,
      status: request.status,
    }))
  },
})

export const setHelpRequestStatus = mutation({
  args: {
    hubId: v.id("hubs"),
    requestId: v.id("helpRequests"),
    status: v.union(v.literal("open"), v.literal("resolved")),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const request = await ctx.db.get("helpRequests", args.requestId)
    if (!request || request.hubId !== args.hubId)
      throw new Error("Help request not found")
    await ctx.db.patch("helpRequests", request._id, { status: args.status })
    return null
  },
})

export const deleteHelpRequest = mutation({
  args: {
    hubId: v.id("hubs"),
    requestId: v.id("helpRequests"),
  },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const request = await ctx.db.get("helpRequests", args.requestId)
    if (!request || request.hubId !== args.hubId)
      throw new Error("Help request not found")
    await ctx.db.delete("helpRequests", request._id)
    return null
  },
})
