import { v } from "convex/values"

import type { AppMessageKey } from "../i18n/messages"
import { normalizeWorkersCanEdit } from "../lib/worker-editing"
import type { Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx } from "./_generated/server"
import {
  canReadPublishedHub,
  requireIdentity,
  requireHubEditingPermission,
  requireHubPermission,
} from "./lib/access"
import {
  assertGuideLinkReplacementFits,
  assertGuideLinksPerHub,
  assertGuideLinksPerItem,
  MAX_GUIDE_LINKS_PER_HUB,
  MAX_GUIDE_LINKS_PER_ITEM,
  resolvePublishedGuides,
} from "./lib/guideLinks"
import { deleteReferencedHubStorage } from "./lib/hubStorage"
import {
  createNotification,
  notifyPublicationChange,
} from "./lib/notifications"
import {
  categoryKind,
  categoryKindValidator,
  ensureDefaultEventTypes,
  resolveEventTypeId,
  storedEventCategoryValues,
} from "./lib/categories"

const richTextDocument = v.object({
  type: v.literal("doc"),
  content: v.optional(v.array(v.any())),
})

const requiredMessageKeys = {
  categoryName: ["categoryNameRequired", "categoryNameTooLong"],
  categoryIcon: ["categoryIconRequired", "categoryIconTooLong"],
  categoryDescription: [
    "categoryDescriptionRequired",
    "categoryDescriptionTooLong",
  ],
  categorySlug: ["categorySlugRequired", "categorySlugTooLong"],
  guideTitle: ["guideTitleRequired", "guideTitleTooLong"],
  guideDescription: ["guideDescriptionRequired", "guideDescriptionTooLong"],
  readingTime: ["readingTimeRequired", "readingTimeTooLong"],
  guideSlug: ["guideSlugRequired", "guideSlugTooLong"],
  eventTitle: ["eventTitleRequired", "eventTitleTooLong"],
  eventDescription: ["eventDescriptionRequired", "eventDescriptionTooLong"],
  eventStart: ["eventStartRequired", "eventStartTooLong"],
  eventEnd: ["eventEndRequired", "eventEndTooLong"],
  iCalendarUid: ["iCalendarUidRequired", "iCalendarUidTooLong"],
  eventLocation: ["eventLocationRequired", "eventLocationTooLong"],
  eventSlug: ["eventSlugRequired", "eventSlugTooLong"],
  announcementTitle: ["announcementTitleRequired", "announcementTitleTooLong"],
  publishDate: ["publishDateRequired", "publishDateTooLong"],
  expiryDate: ["expiryDateRequired", "expiryDateTooLong"],
  announcementSlug: ["announcementSlugRequired", "announcementSlugTooLong"],
  question: ["questionRequired", "questionTooLong"],
  answer: ["answerRequired", "answerTooLong"],
  questionSlug: ["questionSlugRequired", "questionSlugTooLong"],
  topic: ["topicRequired", "topicTooLong"],
  helpMessage: ["helpMessageRequired", "helpMessageTooLong"],
} as const satisfies Record<string, readonly [AppMessageKey, AppMessageKey]>

function required(
  value: string,
  field: keyof typeof requiredMessageKeys,
  max = 500
) {
  const clean = value.trim()
  const [requiredKey, tooLongKey] = requiredMessageKeys[field]
  if (!clean) throw new Error(requiredKey)
  if (clean.length > max) throw new Error(tooLongKey)
  return clean
}

async function resolveEventReference(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    slug: string
    canAccessDrafts: boolean
    allowedDraftIds?: ReadonlySet<Id<"events">>
  }
) {
  const slug = args.slug.trim()
  const event = slug
    ? await ctx.db
        .query("events")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", args.hubId).eq("slug", slug)
        )
        .unique()
    : null
  if (!event) {
    throw new Error(
      args.canAccessDrafts ? "eventNotFound" : "editingAccessRequired"
    )
  }
  if (
    !event.published &&
    !args.canAccessDrafts &&
    !args.allowedDraftIds?.has(event._id)
  ) {
    throw new Error("editingAccessRequired")
  }
  return event
}

export const saveCategory = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    label: v.string(),
    iconKey: v.string(),
    description: v.string(),
    kind: v.optional(categoryKindValidator),
  },
  handler: async (ctx, args) => {
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
    const requestedKind = args.kind ?? "guide"
    if (requestedKind === "event") {
      await ensureDefaultEventTypes(ctx, args.hubId)
    }
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (existing && categoryKind(existing) !== requestedKind) {
      throw new Error("categoryTypeCannotChange")
    }
    if (!existing && permission === "editor") {
      throw new Error("fullContentAccessRequiredCreateContent")
    }
    const value = {
      label: required(args.label, "categoryName", 80),
      iconKey: required(args.iconKey, "categoryIcon", 40),
      description:
        requestedKind === "guide"
          ? required(args.description, "categoryDescription", 300)
          : args.description.trim().slice(0, 300),
      kind: requestedKind,
    }
    if (existing) {
      await ctx.db.patch("categories", existing._id, {
        ...value,
        systemLabelKey: undefined,
      })
      return existing.slug
    }
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
      .take(500)
    await ctx.db.insert("categories", {
      hubId: args.hubId,
      slug: required(args.slug, "categorySlug", 80),
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
    kind: v.optional(categoryKindValidator),
    direction: v.union(v.literal(-1), v.literal(1)),
  },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "editor")
    const requestedKind = args.kind ?? "guide"
    if (requestedKind === "event") {
      await ensureDefaultEventTypes(ctx, args.hubId)
    }
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
      .take(500)
      .then((items) =>
        items.filter((category) => categoryKind(category) === requestedKind)
      )
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
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    kind: v.optional(categoryKindValidator),
  },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    const requestedKind = args.kind ?? "guide"
    if (requestedKind === "event") {
      await ensureDefaultEventTypes(ctx, args.hubId)
    }
    const category = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!category) return null
    if (categoryKind(category) !== requestedKind) {
      throw new Error("categoryNotFound")
    }
    if (requestedKind === "guide") {
      const guide = await ctx.db
        .query("guides")
        .withIndex("by_categoryId", (q) => q.eq("categoryId", category._id))
        .first()
      if (guide) throw new Error("reassignGuidesBeforeDeletingThisCategory")
    } else {
      const eventTypes = await ctx.db
        .query("categories")
        .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
        .take(500)
        .then((items) => items.filter((item) => categoryKind(item) === "event"))
      if (eventTypes.length <= 1) throw new Error("atLeastOneEventTypeRequired")
      const categoryValues = storedEventCategoryValues(category)
      const events = await ctx.db
        .query("events")
        .withIndex("by_hubId_and_start", (q) => q.eq("hubId", args.hubId))
        .take(501)
      if (
        events.length > 500 ||
        events.some((event) => categoryValues.has(event.category))
      ) {
        throw new Error("reassignEventsBeforeDeletingThisCategory")
      }
    }
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
    relatedGuideSlugs: v.optional(v.array(v.string())),
    content: richTextDocument,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { hub, permission } = await requireHubEditingPermission(
      ctx,
      args.hubId,
      "guides"
    )
    const category = await ctx.db
      .query("categories")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.categorySlug)
      )
      .unique()
    if (!category) throw new Error("guideCategoryNotFound")
    if (categoryKind(category) !== "guide") {
      throw new Error("guideCategoryNotFound")
    }
    const existing = await ctx.db
      .query("guides")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (
      !existing &&
      permission === "editor" &&
      !normalizeWorkersCanEdit(hub.workersCanEdit).guides
    ) {
      throw new Error("fullContentAccessRequiredCreateContent")
    }
    const value = {
      title: required(args.title, "guideTitle", 140),
      description: required(args.description, "guideDescription", 500),
      categoryId: category._id,
      duration: required(args.duration, "readingTime", 40),
      updatedLabel: "Updated just now",
      featured: args.featured,
      published: args.published,
      keywords: args.keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .slice(0, 40),
      content: args.content,
    }
    const guideId = existing
      ? (await ctx.db.patch("guides", existing._id, value), existing._id)
      : await ctx.db.insert("guides", {
          hubId: args.hubId,
          slug: required(args.slug, "guideSlug", 100),
          ...value,
        })

    if (args.relatedGuideSlugs !== undefined) {
      const [oldRelations, hubRelations, resolvedGuides] = await Promise.all([
        ctx.db
          .query("guideRelations")
          .withIndex("by_guideId", (q) => q.eq("guideId", guideId))
          .take(MAX_GUIDE_LINKS_PER_ITEM + 1),
        ctx.db
          .query("guideRelations")
          .withIndex("by_hubId", (q) => q.eq("hubId", args.hubId))
          .take(MAX_GUIDE_LINKS_PER_HUB + 1),
        resolvePublishedGuides(ctx, {
          hubId: args.hubId,
          slugs: args.relatedGuideSlugs,
        }),
      ])
      const relatedGuides = resolvedGuides.filter(
        (relatedGuide) => relatedGuide._id !== guideId
      )
      assertGuideLinkReplacementFits({
        hubCount: hubRelations.length,
        previousCount: oldRelations.length,
        nextCount: relatedGuides.length,
      })
      for (const relation of oldRelations) {
        await ctx.db.delete("guideRelations", relation._id)
      }
      for (const relatedGuide of relatedGuides) {
        await ctx.db.insert("guideRelations", {
          hubId: args.hubId,
          guideId,
          relatedGuideId: relatedGuide._id,
        })
      }
    }
    await notifyPublicationChange(ctx, {
      hubId: args.hubId,
      kind: "guide",
      wasPublished: existing?.published ?? false,
      isPublished: args.published,
      contentTitle: value.title,
      detailHref: `/guides/${args.slug}`,
      listHref: "/guides",
      publishedTitleKey: "notificationNewGuidePublished",
      updatedTitleKey: "notificationGuideUpdated",
      unpublishedTitleKey: "notificationGuideUnpublished",
    })
    return args.slug
  },
})

export const deleteGuide = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    const guide = await ctx.db
      .query("guides")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!guide) return null
    const [
      eventRelations,
      announcements,
      outgoingGuideRelations,
      incomingGuideRelations,
      documentRelations,
    ] = await Promise.all([
      ctx.db
        .query("eventGuides")
        .withIndex("by_guideId", (q) => q.eq("guideId", guide._id))
        .take(MAX_GUIDE_LINKS_PER_HUB + 1),
      ctx.db
        .query("announcements")
        .withIndex("by_guideId", (q) => q.eq("guideId", guide._id))
        .take(500),
      ctx.db
        .query("guideRelations")
        .withIndex("by_guideId", (q) => q.eq("guideId", guide._id))
        .take(MAX_GUIDE_LINKS_PER_ITEM + 1),
      ctx.db
        .query("guideRelations")
        .withIndex("by_relatedGuideId", (q) =>
          q.eq("relatedGuideId", guide._id)
        )
        .take(MAX_GUIDE_LINKS_PER_HUB + 1),
      ctx.db
        .query("documentGuides")
        .withIndex("by_guideId", (q) => q.eq("guideId", guide._id))
        .take(MAX_GUIDE_LINKS_PER_HUB + 1),
    ])
    assertGuideLinksPerHub(eventRelations.length)
    assertGuideLinksPerItem(outgoingGuideRelations.length)
    assertGuideLinksPerHub(incomingGuideRelations.length)
    assertGuideLinksPerHub(documentRelations.length)
    for (const relation of eventRelations)
      await ctx.db.delete("eventGuides", relation._id)
    for (const relation of outgoingGuideRelations)
      await ctx.db.delete("guideRelations", relation._id)
    for (const relation of incomingGuideRelations)
      await ctx.db.delete("guideRelations", relation._id)
    for (const relation of documentRelations)
      await ctx.db.delete("documentGuides", relation._id)
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
        titleKey: "notificationGuideRemoved",
        messageKey: "notificationContentNoLongerAvailable",
        messageValues: { title: guide.title },
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
    category: v.string(),
    start: v.string(),
    end: v.string(),
    allDay: v.optional(v.boolean()),
    startUtc: v.optional(v.union(v.string(), v.null())),
    endUtc: v.optional(v.union(v.string(), v.null())),
    icalUid: v.optional(v.union(v.string(), v.null())),
    location: v.string(),
    employeeProfileIds: v.optional(v.array(v.id("employeeProfiles"))),
    notes: v.string(),
    published: v.boolean(),
    guideSlugs: v.array(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { hub, permission } = await requireHubEditingPermission(
      ctx,
      args.hubId,
      "events"
    )
    const identity = await requireIdentity(ctx)
    const category = await resolveEventTypeId(ctx, args.hubId, args.category)
    const hasExactInstants = Boolean(args.startUtc && args.endUtc)
    if (Boolean(args.startUtc) !== Boolean(args.endUtc)) {
      throw new Error("eventStartEndInstantsProvidedTogether")
    }
    if (args.allDay && hasExactInstants) {
      throw new Error("allDayEventsCannotIncludeTimedInstants")
    }
    const startsAt = args.startUtc ? Date.parse(args.startUtc) : null
    const endsAt = args.endUtc ? Date.parse(args.endUtc) : null
    if (
      (startsAt !== null && Number.isNaN(startsAt)) ||
      (endsAt !== null && Number.isNaN(endsAt))
    ) {
      throw new Error("eventContainsAnInvalidExactDate")
    }
    if (
      hasExactInstants
        ? (endsAt as number) <= (startsAt as number)
        : args.end <= args.start
    )
      throw new Error("eventEndAfterStart")
    const existing = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    const oldGuideRelations = existing
      ? await ctx.db
          .query("eventGuides")
          .withIndex("by_eventId", (q) => q.eq("eventId", existing._id))
          .take(MAX_GUIDE_LINKS_PER_ITEM + 1)
      : []
    if (
      !existing &&
      permission === "editor" &&
      !normalizeWorkersCanEdit(hub.workersCanEdit).events
    ) {
      throw new Error("fullContentAccessRequiredCreateContent")
    }
    const [selectedGuides, hubGuideRelations] = await Promise.all([
      resolvePublishedGuides(ctx, {
        hubId: args.hubId,
        slugs: args.guideSlugs,
      }),
      ctx.db
        .query("eventGuides")
        .withIndex("by_hubId", (q) => q.eq("hubId", args.hubId))
        .take(MAX_GUIDE_LINKS_PER_HUB + 1),
    ])
    assertGuideLinkReplacementFits({
      hubCount: hubGuideRelations.length,
      previousCount: oldGuideRelations.length,
      nextCount: selectedGuides.length,
    })
    const value = {
      title: required(args.title, "eventTitle", 140),
      description: required(args.description, "eventDescription", 500),
      category,
      start: required(args.start, "eventStart", 40),
      end: required(args.end, "eventEnd", 40),
      allDay: args.allDay ?? false,
      startUtc: args.startUtc ?? undefined,
      endUtc: args.endUtc ?? undefined,
      icalUid: args.icalUid
        ? required(args.icalUid, "iCalendarUid", 512)
        : undefined,
      location: required(args.location, "eventLocation", 140),
      notes: args.notes.trim().slice(0, 4000),
      published: args.published,
    }
    const eventId = existing
      ? (await ctx.db.patch("events", existing._id, value), existing._id)
      : await ctx.db.insert("events", {
          hubId: args.hubId,
          slug: required(args.slug, "eventSlug", 100),
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
          throw new Error("employeeNotBelongWorkplace")
        }
        if (
          profile.status === "deactivated" &&
          !oldByEmployeeId.has(employeeProfileId)
        ) {
          throw new Error("deactivatedEmployeesCannotAddedEvents")
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

    for (const relation of oldGuideRelations)
      await ctx.db.delete("eventGuides", relation._id)
    for (const guide of selectedGuides) {
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
      publishedTitleKey: "notificationNewEventAdded",
      updatedTitleKey: "notificationEventUpdated",
      unpublishedTitleKey: "notificationEventUnpublished",
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
          titleKey: "notificationAssignedToEvent",
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
          .take(MAX_GUIDE_LINKS_PER_ITEM + 1),
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
    assertGuideLinksPerItem(relations.length)
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
        titleKey: "notificationEventRemoved",
        messageKey: "notificationEventNoLongerOnCalendar",
        messageValues: { title: event.title },
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
  returns: v.string(),
  handler: async (ctx, args) => {
    const { hub, permission } = await requireHubEditingPermission(
      ctx,
      args.hubId,
      "announcements"
    )
    if (args.expiresAt < args.publishedAt)
      throw new Error("expiryAfterPublishDate")
    const existing = await ctx.db
      .query("announcements")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    const workersCanEdit = normalizeWorkersCanEdit(hub.workersCanEdit)
    const canAccessDraftEvents =
      permission !== "viewer" || workersCanEdit.events
    const guide =
      args.guideSlug !== undefined
        ? (
            await resolvePublishedGuides(ctx, {
              hubId: args.hubId,
              slugs: [args.guideSlug],
            })
          )[0]
        : null
    const event =
      args.eventSlug !== undefined
        ? await resolveEventReference(ctx, {
            hubId: args.hubId,
            slug: args.eventSlug,
            canAccessDrafts: canAccessDraftEvents,
            ...(existing?.eventId
              ? { allowedDraftIds: new Set([existing.eventId]) }
              : {}),
          })
        : null
    if (
      !existing &&
      permission === "editor" &&
      !normalizeWorkersCanEdit(hub.workersCanEdit).announcements
    ) {
      throw new Error("fullContentAccessRequiredCreateContent")
    }
    const value = {
      title: required(args.title, "announcementTitle", 140),
      content: args.content,
      publishedAt: required(args.publishedAt, "publishDate", 10),
      expiresAt: required(args.expiresAt, "expiryDate", 10),
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
        slug: required(args.slug, "announcementSlug", 100),
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
      publishedTitleKey: "notificationNewAnnouncement",
      updatedTitleKey: "notificationAnnouncementUpdated",
      unpublishedTitleKey: "notificationAnnouncementUnpublished",
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
          titleKey: "notificationAnnouncementRemoved",
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
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { hub, permission } = await requireHubEditingPermission(
      ctx,
      args.hubId,
      "faqs"
    )
    const existing = await ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (
      !existing &&
      permission === "editor" &&
      !normalizeWorkersCanEdit(hub.workersCanEdit).faqs
    ) {
      throw new Error("fullContentAccessRequiredCreateContent")
    }
    const value = {
      question: required(args.question, "question", 300),
      answer: required(args.answer, "answer", 4000),
      published: true,
    }
    if (existing) await ctx.db.patch("faqs", existing._id, value)
    else {
      const faqs = await ctx.db
        .query("faqs")
        .withIndex("by_hubId_and_order", (q) => q.eq("hubId", args.hubId))
        .take(500)
      await ctx.db.insert("faqs", {
        hubId: args.hubId,
        slug: required(args.slug, "questionSlug", 120),
        order: faqs.length,
        ...value,
      })
    }
    await createNotification(ctx, {
      hubId: args.hubId,
      audience: "employees",
      kind: "question",
      titleKey: existing
        ? "notificationCommonAnswerUpdated"
        : "notificationNewCommonAnswer",
      message: value.question,
      href: `/questions#${args.slug}`,
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
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubEditingPermission(ctx, args.hubId, "faqs")
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
  returns: v.null(),
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
      await createNotification(ctx, {
        hubId: args.hubId,
        audience: "employees",
        kind: "question",
        titleKey: "notificationCommonAnswerRemoved",
        message: faq.question,
        href: "/questions",
      })
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
      throw new Error("hubAccessRequired")
    const topic = required(args.topic, "topic", 140)
    await ctx.db.insert("helpRequests", {
      hubId: hub._id,
      topic,
      message: required(args.message, "helpMessage", 2000),
      submittedAt: Date.now(),
      status: "open",
    })
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "managers",
      kind: "question",
      titleKey: "notificationNewEmployeeQuestion",
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
      throw new Error("helpRequestNotFound")
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
      throw new Error("helpRequestNotFound")
    await ctx.db.delete("helpRequests", request._id)
    return null
  },
})
