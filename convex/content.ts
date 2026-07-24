import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import { mutation, query } from "./_generated/server"
import {
  canReadPublishedHub,
  requireIdentity,
  requireHubPermission,
} from "./lib/access"
import { deleteReferencedHubStorage } from "./lib/hubStorage"
import {
  createNotification,
  notifyPublicationChange,
} from "./lib/notifications"

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
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!existing && permission === "editor") {
      throw new Error("Full content access is required to create content")
    }
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
    await requireHubPermission(ctx, args.hubId, "editor")
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
    await requireHubPermission(ctx, args.hubId, "manager")
    const category = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!category) return null
    const guide = await ctx.db
      .query("guides")
      .withIndex("by_categoryId", (q) => q.eq("categoryId", category._id))
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
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
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
    if (!existing && permission === "editor") {
      throw new Error("Full content access is required to create content")
    }
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
    await notifyPublicationChange(ctx, {
      hubId: args.hubId,
      kind: "guide",
      wasPublished: existing?.published ?? false,
      isPublished: args.published,
      contentTitle: value.title,
      detailHref: `/guides/${args.slug}`,
      listHref: "/guides",
      publishedTitle: "New guide published",
      updatedTitle: "Guide updated",
      unpublishedTitle: "Guide unpublished",
    })
    return args.slug
  },
})

export const deleteGuide = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
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
        .withIndex("by_guideId", (q) => q.eq("guideId", guide._id))
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
    if (guide.published) {
      await createNotification(ctx, {
        hubId: args.hubId,
        audience: "employees",
        kind: "guide",
        title: "Guide removed",
        message: `${guide.title} is no longer available.`,
        href: "/guides",
      })
    }
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
    allDay: v.optional(v.boolean()),
    startUtc: v.optional(v.union(v.string(), v.null())),
    endUtc: v.optional(v.union(v.string(), v.null())),
    location: v.string(),
    employeeProfileIds: v.optional(v.array(v.id("employeeProfiles"))),
    notes: v.string(),
    published: v.boolean(),
    guideSlugs: v.array(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
    const identity = await requireIdentity(ctx)
    const hasExactInstants = Boolean(args.startUtc && args.endUtc)
    if (Boolean(args.startUtc) !== Boolean(args.endUtc)) {
      throw new Error("Event start and end instants must be provided together")
    }
    if (args.allDay && hasExactInstants) {
      throw new Error("All-day events cannot include timed instants")
    }
    const startsAt = args.startUtc ? Date.parse(args.startUtc) : null
    const endsAt = args.endUtc ? Date.parse(args.endUtc) : null
    if (
      (startsAt !== null && Number.isNaN(startsAt)) ||
      (endsAt !== null && Number.isNaN(endsAt))
    ) {
      throw new Error("Event contains an invalid exact date")
    }
    if (
      hasExactInstants
        ? (endsAt as number) <= (startsAt as number)
        : args.end <= args.start
    )
      throw new Error("Event end must be after its start")
    const existing = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!existing && permission === "editor") {
      throw new Error("Full content access is required to create content")
    }
    const value = {
      title: required(args.title, "Event title", 140),
      description: required(args.description, "Event description", 500),
      category: args.category,
      start: required(args.start, "Event start", 40),
      end: required(args.end, "Event end", 40),
      allDay: args.allDay ?? false,
      startUtc: args.startUtc ?? undefined,
      endUtc: args.endUtc ?? undefined,
      location: required(args.location, "Event location", 140),
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

    const newlyAssignedEmployeeIds: Id<"employeeProfiles">[] = []
    if (args.employeeProfileIds !== undefined) {
      const selectedIds = [...new Set(args.employeeProfileIds)].slice(0, 100)
      const oldEmployeeRelations = await ctx.db
        .query("eventEmployees")
        .withIndex("by_eventId_and_employeeProfileId", (q) =>
          q.eq("eventId", eventId)
        )
        .take(200)
      const oldByEmployeeId = new Map(
        oldEmployeeRelations.map((relation) => [
          relation.employeeProfileId,
          relation,
        ])
      )
      for (const employeeProfileId of selectedIds) {
        const profile = await ctx.db.get("employeeProfiles", employeeProfileId)
        if (!profile || profile.hubId !== args.hubId) {
          throw new Error("Employee does not belong to this workplace")
        }
        if (
          profile.status === "deactivated" &&
          !oldByEmployeeId.has(employeeProfileId)
        ) {
          throw new Error("Deactivated employees cannot be added to events")
        }
        if (!oldByEmployeeId.has(employeeProfileId)) {
          await ctx.db.insert("eventEmployees", {
            hubId: args.hubId,
            eventId,
            employeeProfileId,
            addedAt: Date.now(),
            addedBy: identity.subject,
          })
          newlyAssignedEmployeeIds.push(employeeProfileId)
        }
      }
      const selected = new Set(selectedIds)
      for (const relation of oldEmployeeRelations) {
        if (!selected.has(relation.employeeProfileId)) {
          await ctx.db.delete("eventEmployees", relation._id)
        }
      }
    }

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
    await notifyPublicationChange(ctx, {
      hubId: args.hubId,
      kind: "event",
      wasPublished: existing?.published ?? false,
      isPublished: args.published,
      contentTitle: value.title,
      detailHref: `/calendar/${args.slug}`,
      listHref: "/calendar",
      publishedTitle: "New event added",
      updatedTitle: "Event updated",
      unpublishedTitle: "Event unpublished",
    })
    if (args.published) {
      const assignmentRecipients = !existing?.published
        ? (
            await ctx.db
              .query("eventEmployees")
              .withIndex("by_eventId_and_employeeProfileId", (q) =>
                q.eq("eventId", eventId)
              )
              .take(200)
          ).map((relation) => relation.employeeProfileId)
        : newlyAssignedEmployeeIds
      for (const employeeProfileId of assignmentRecipients) {
        await createNotification(ctx, {
          hubId: args.hubId,
          audience: "employee",
          employeeProfileId,
          kind: "event",
          title: "You were assigned to an event",
          message: value.title,
          href: `/calendar/${args.slug}`,
        })
      }
    }
    return args.slug
  },
})

export const deleteEvent = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    const event = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!event) return null
    const [relations, employeeRelations, attachments, announcements] =
      await Promise.all([
        ctx.db
          .query("eventGuides")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(1000),
        ctx.db
          .query("eventEmployees")
          .withIndex("by_eventId_and_employeeProfileId", (q) =>
            q.eq("eventId", event._id)
          )
          .take(1000),
        ctx.db
          .query("attachments")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(1000),
        ctx.db
          .query("announcements")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .take(500),
      ])
    for (const relation of relations)
      await ctx.db.delete("eventGuides", relation._id)
    for (const relation of employeeRelations)
      await ctx.db.delete("eventEmployees", relation._id)
    for (const attachment of attachments) {
      await deleteReferencedHubStorage(ctx, {
        hubId: args.hubId,
        storageId: attachment.storageId,
        binding: {
          kind: "eventAttachment",
          attachmentId: attachment._id,
        },
        allowUntracked: true,
      })
      await ctx.db.delete("attachments", attachment._id)
    }
    for (const announcement of announcements) {
      await ctx.db.patch("announcements", announcement._id, {
        eventId: undefined,
      })
    }
    await ctx.db.delete("events", event._id)
    if (event.published) {
      await createNotification(ctx, {
        hubId: args.hubId,
        audience: "employees",
        kind: "event",
        title: "Event removed",
        message: `${event.title} is no longer on the calendar.`,
        href: "/calendar",
      })
    }
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
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
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
    if (!existing && permission === "editor") {
      throw new Error("Full content access is required to create content")
    }
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
    await notifyPublicationChange(ctx, {
      hubId: args.hubId,
      kind: "announcement",
      wasPublished: existing?.published ?? false,
      isPublished: args.published,
      contentTitle: value.title,
      detailHref: `/announcements/${args.slug}`,
      listHref: "/announcements",
      publishedTitle: "New announcement",
      updatedTitle: "Announcement updated",
      unpublishedTitle: "Announcement unpublished",
    })
    return args.slug
  },
})

export const deleteAnnouncement = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    const announcement = await ctx.db
      .query("announcements")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (announcement) {
      await ctx.db.delete("announcements", announcement._id)
      if (announcement.published) {
        await createNotification(ctx, {
          hubId: args.hubId,
          audience: "employees",
          kind: "announcement",
          title: "Announcement removed",
          message: announcement.title,
          href: "/announcements",
        })
      }
    }
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
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
    const existing = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!existing && permission === "editor") {
      throw new Error("Full content access is required to create content")
    }
    const value = {
      question: required(args.question, "Question", 300),
      answer: required(args.answer, "Answer", 4000),
      published: args.published,
    }
    if (existing) await ctx.db.patch("faqs", existing._id, value)
    else {
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
    }
    await notifyPublicationChange(ctx, {
      hubId: args.hubId,
      kind: "question",
      wasPublished: existing?.published ?? false,
      isPublished: args.published,
      contentTitle: value.question,
      detailHref: `/questions#${args.slug}`,
      listHref: "/questions",
      publishedTitle: "New common answer",
      updatedTitle: "Common answer updated",
      unpublishedTitle: "Common answer unpublished",
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
    await requireHubPermission(ctx, args.hubId, "editor")
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
    await requireHubPermission(ctx, args.hubId, "manager")
    const faq = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (faq) {
      await ctx.db.delete("faqs", faq._id)
      if (faq.published) {
        await createNotification(ctx, {
          hubId: args.hubId,
          audience: "employees",
          kind: "question",
          title: "Common answer removed",
          message: faq.question,
          href: "/questions",
        })
      }
    }
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
    const topic = required(args.topic, "Topic", 140)
    await ctx.db.insert("helpRequests", {
      hubId: hub._id,
      topic,
      message: required(args.message, "Question", 2000),
      submittedAt: Date.now(),
      status: "open",
    })
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "managers",
      kind: "question",
      title: "New employee question",
      message: topic,
      href: "/manager/help",
    })
    return null
  },
})

export const listHelpRequests = query({
  args: { hubId: v.id("hubs") },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "owner")
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
    await requireHubPermission(ctx, args.hubId, "owner")
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
    await requireHubPermission(ctx, args.hubId, "owner")
    const request = await ctx.db.get("helpRequests", args.requestId)
    if (!request || request.hubId !== args.hubId)
      throw new Error("Help request not found")
    await ctx.db.delete("helpRequests", request._id)
    return null
  },
})
