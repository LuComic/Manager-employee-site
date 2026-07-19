import type { Doc } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { normalizeTodaySections } from "../../lib/today-sections"

export async function buildSnapshot(
  ctx: QueryCtx,
  hub: Doc<"hubs">,
  options: { includeDrafts: boolean; nowDate: string }
) {
  const [
    categories,
    allGuides,
    allEvents,
    allAnnouncements,
    eventGuides,
    attachments,
    allFaqs,
    allDocuments,
  ] = await Promise.all([
    ctx.db
      .query("categories")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hub._id))
      .take(500),
    ctx.db
      .query("guides")
      .withIndex("by_hubId_and_published", (q) => q.eq("hubId", hub._id))
      .take(500),
    ctx.db
      .query("events")
      .withIndex("by_hubId_and_start", (q) => q.eq("hubId", hub._id))
      .take(500),
    ctx.db
      .query("announcements")
      .withIndex("by_hubId_and_published", (q) => q.eq("hubId", hub._id))
      .take(500),
    ctx.db
      .query("eventGuides")
      .withIndex("by_hubId", (q) => q.eq("hubId", hub._id))
      .take(1000),
    ctx.db
      .query("attachments")
      .withIndex("by_hubId", (q) => q.eq("hubId", hub._id))
      .take(1000),
    ctx.db
      .query("faqs")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hub._id))
      .take(500),
    ctx.db
      .query("documents")
      .withIndex("by_hubId_and_updatedAt", (q) => q.eq("hubId", hub._id))
      .order("desc")
      .take(500),
  ])

  const guides = options.includeDrafts
    ? allGuides
    : allGuides.filter((guide) => guide.published)
  const events = options.includeDrafts
    ? allEvents
    : allEvents.filter((event) => event.published)
  const announcements = options.includeDrafts
    ? allAnnouncements
    : allAnnouncements.filter(
        (announcement) =>
          announcement.published && announcement.expiresAt >= options.nowDate
      )
  const faqs = options.includeDrafts
    ? allFaqs
    : allFaqs.filter((faq) => faq.published)
  const documents = options.includeDrafts
    ? allDocuments
    : allDocuments.filter((document) => document.published)

  const categorySlugById = new Map(
    categories.map((category) => [category._id, category.slug])
  )
  const guideSlugById = new Map(guides.map((guide) => [guide._id, guide.slug]))
  const eventSlugById = new Map(events.map((event) => [event._id, event.slug]))
  const guideIdsByEventId = new Map<string, string[]>()
  for (const relation of eventGuides) {
    const guideSlug = guideSlugById.get(relation.guideId)
    if (!guideSlug) continue
    const current = guideIdsByEventId.get(relation.eventId) ?? []
    current.push(guideSlug)
    guideIdsByEventId.set(relation.eventId, current)
  }

  const attachmentsByEventId = new Map<
    string,
    Array<{
      id: string
      name: string
      contentType: string
      size: number
      url: string
    }>
  >()
  for (const attachment of attachments) {
    if (!eventSlugById.has(attachment.eventId)) continue
    const url = await ctx.storage.getUrl(attachment.storageId)
    if (!url) continue
    const current = attachmentsByEventId.get(attachment.eventId) ?? []
    current.push({
      id: attachment._id,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      url,
    })
    attachmentsByEventId.set(attachment.eventId, current)
  }

  return {
    hub: {
      id: hub._id,
      name: hub.name,
      slug: hub.slug,
      accessMode: hub.accessMode,
      credentialVersion: hub.credentialVersion,
      description:
        hub.description ??
        "Current updates, important times, and practical guides for each shift.",
      address: hub.address ?? "",
      timeZone: hub.timeZone ?? "Europe/Tallinn",
      contactName: hub.contactName ?? "shift lead",
      contactEmail: hub.contactEmail ?? "",
      contactPhone: hub.contactPhone ?? "",
      todaySections: normalizeTodaySections(hub.todaySections),
      contentVersion: hub.contentVersion ?? 0,
    },
    categories: categories.map((category) => ({
      id: category.slug,
      label: category.label,
      iconKey: category.iconKey,
      description: category.description,
      order: category.order,
    })),
    guides: guides.flatMap((guide) => {
      const category = categorySlugById.get(guide.categoryId)
      if (!category) return []
      return [
        {
          id: guide.slug,
          title: guide.title,
          description: guide.description,
          category,
          duration: guide.duration,
          updated: guide.updatedLabel,
          featured: guide.featured,
          published: guide.published,
          keywords: guide.keywords,
          content: guide.content,
        },
      ]
    }),
    events: events.map((event) => ({
      id: event.slug,
      title: event.title,
      description: event.description,
      category: event.category,
      start: event.start,
      end: event.end,
      location: event.location,
      owner: event.owner,
      notes: event.notes,
      published: event.published,
      guideIds: guideIdsByEventId.get(event._id) ?? [],
      attachments: attachmentsByEventId.get(event._id) ?? [],
    })),
    announcements: announcements.map((announcement) => ({
      id: announcement.slug,
      title: announcement.title,
      content: announcement.content,
      publishedAt: announcement.publishedAt,
      expiresAt: announcement.expiresAt,
      priority: announcement.priority,
      pinned: announcement.pinned,
      published: announcement.published,
      guideId: announcement.guideId
        ? guideSlugById.get(announcement.guideId)
        : undefined,
      eventId: announcement.eventId
        ? eventSlugById.get(announcement.eventId)
        : undefined,
    })),
    faqs: faqs.map((faq) => ({
      id: faq.slug,
      question: faq.question,
      answer: faq.answer,
      order: faq.order,
      published: faq.published,
    })),
    documents: documents.map((document) => ({
      id: document.slug,
      title: document.title,
      description: document.description,
      type: document.type,
      content: document.content,
      published: document.published,
      updatedAt: document.updatedAt,
    })),
  }
}
