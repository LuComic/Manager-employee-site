import type { Doc } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { normalizeTodaySections } from "../../lib/today-sections"
import {
  normalizeWorkersCanEdit,
  type WorkersCanEdit,
} from "../../lib/worker-editing"

export async function buildSnapshot(
  ctx: QueryCtx,
  hub: Doc<"hubs">,
  options: {
    includeDrafts: boolean
    workerSections?: WorkersCanEdit
    includeOrganizationMapping: boolean
    nowDate: string
  }
) {
  const [
    bannerImageUrl,
    categories,
    allGuides,
    guideRelations,
    allEvents,
    allAnnouncements,
    eventGuides,
    attachments,
    allFaqs,
    allDocuments,
    documentGuides,
    eventEmployees,
    documentEmployees,
    employeeProfiles,
  ] = await Promise.all([
    hub.bannerStorageId ? ctx.storage.getUrl(hub.bannerStorageId) : null,
    ctx.db
      .query("categories")
      .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hub._id))
      .take(500),
    ctx.db
      .query("guides")
      .withIndex("by_hubId_and_published", (q) => q.eq("hubId", hub._id))
      .take(500),
    ctx.db
      .query("guideRelations")
      .withIndex("by_hubId", (q) => q.eq("hubId", hub._id))
      .take(1000),
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
    ctx.db
      .query("documentGuides")
      .withIndex("by_hubId", (q) => q.eq("hubId", hub._id))
      .take(1000),
    ctx.db
      .query("eventEmployees")
      .withIndex("by_hubId_and_eventId", (q) => q.eq("hubId", hub._id))
      .take(2000),
    ctx.db
      .query("documentEmployees")
      .withIndex("by_hubId_and_documentId", (q) => q.eq("hubId", hub._id))
      .take(2000),
    ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_displayName", (q) => q.eq("hubId", hub._id))
      .take(500),
  ])

  const includeGuideDrafts =
    options.includeDrafts && (options.workerSections?.guides ?? true)
  const includeEventDrafts =
    options.includeDrafts && (options.workerSections?.events ?? true)
  const includeAnnouncementDrafts =
    options.includeDrafts && (options.workerSections?.announcements ?? true)
  const includeDocumentDrafts =
    options.includeDrafts && (options.workerSections?.documents ?? true)
  const guides = includeGuideDrafts
    ? allGuides
    : allGuides.filter((guide) => guide.published)
  const events = includeEventDrafts
    ? allEvents
    : allEvents.filter((event) => event.published)
  const announcements = includeAnnouncementDrafts
    ? allAnnouncements
    : allAnnouncements.filter(
        (announcement) =>
          announcement.published && announcement.expiresAt >= options.nowDate
      )
  const documents = includeDocumentDrafts
    ? allDocuments
    : allDocuments.filter((document) => document.published)

  const categorySlugById = new Map(
    categories.map((category) => [category._id, category.slug])
  )
  const guideSlugById = new Map(guides.map((guide) => [guide._id, guide.slug]))
  const eventSlugById = new Map(events.map((event) => [event._id, event.slug]))
  const allGuideSlugById = new Map(
    allGuides.map((guide) => [guide._id, guide.slug])
  )
  const allEventSlugById = new Map(
    allEvents.map((event) => [event._id, event.slug])
  )
  const guideRelationSlugById = options.workerSections?.guides
    ? allGuideSlugById
    : guideSlugById
  const eventGuideSlugById = options.workerSections?.events
    ? allGuideSlugById
    : guideSlugById
  const documentGuideSlugById = options.workerSections?.documents
    ? allGuideSlugById
    : guideSlugById
  const announcementGuideSlugById = options.workerSections?.announcements
    ? allGuideSlugById
    : guideSlugById
  const announcementEventSlugById = options.workerSections?.announcements
    ? allEventSlugById
    : eventSlugById
  const guideReferenceIds = new Set(guides.map((guide) => guide._id))
  const eventReferenceIds = new Set(events.map((event) => event._id))
  const editableEventIds = new Set(events.map((event) => event._id))
  const editableDocumentIds = new Set(documents.map((document) => document._id))
  if (options.workerSections?.events) {
    for (const relation of eventGuides) {
      if (editableEventIds.has(relation.eventId)) {
        guideReferenceIds.add(relation.guideId)
      }
    }
  }
  if (options.workerSections?.announcements) {
    for (const announcement of announcements) {
      if (announcement.guideId) guideReferenceIds.add(announcement.guideId)
      if (announcement.eventId) eventReferenceIds.add(announcement.eventId)
    }
  }
  if (options.workerSections?.documents) {
    for (const relation of documentGuides) {
      if (editableDocumentIds.has(relation.documentId)) {
        guideReferenceIds.add(relation.guideId)
      }
    }
  }
  const relatedGuideIdsByGuideId = new Map<string, string[]>()
  for (const relation of guideRelations) {
    if (!guideSlugById.has(relation.guideId)) continue
    const relatedGuideSlug = guideRelationSlugById.get(relation.relatedGuideId)
    if (!relatedGuideSlug) continue
    const current = relatedGuideIdsByGuideId.get(relation.guideId) ?? []
    current.push(relatedGuideSlug)
    relatedGuideIdsByGuideId.set(relation.guideId, current)
  }
  const guideIdsByEventId = new Map<string, string[]>()
  for (const relation of eventGuides) {
    const guideSlug = eventGuideSlugById.get(relation.guideId)
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

  const employeeById = new Map(
    employeeProfiles.map((profile) => [profile._id, profile])
  )
  const employeesByEventId = new Map<
    string,
    Array<{ id: string; displayName: string }>
  >()
  for (const relation of eventEmployees) {
    const profile = employeeById.get(relation.employeeProfileId)
    if (!profile) continue
    const current = employeesByEventId.get(relation.eventId) ?? []
    current.push({ id: profile._id, displayName: profile.displayName })
    employeesByEventId.set(relation.eventId, current)
  }
  const employeesByDocumentId = new Map<
    string,
    Array<{ id: string; displayName: string }>
  >()
  for (const relation of documentEmployees) {
    const profile = employeeById.get(relation.employeeProfileId)
    if (!profile) continue
    const current = employeesByDocumentId.get(relation.documentId) ?? []
    current.push({ id: profile._id, displayName: profile.displayName })
    employeesByDocumentId.set(relation.documentId, current)
  }
  const guideIdsByDocumentId = new Map<string, string[]>()
  for (const relation of documentGuides) {
    const guideSlug = documentGuideSlugById.get(relation.guideId)
    if (!guideSlug) continue
    const current = guideIdsByDocumentId.get(relation.documentId) ?? []
    current.push(guideSlug)
    guideIdsByDocumentId.set(relation.documentId, current)
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
        "Praegused uuendused, olulised kellaajad ja praktilised juhendid igaks vahetuseks.",
      address: hub.address ?? "",
      timeZone: hub.timeZone ?? "Europe/Tallinn",
      contactName: hub.contactName ?? "vahetusvanem",
      contactEmail: hub.contactEmail ?? "",
      contactPhone: hub.contactPhone ?? "",
      bannerImageUrl: bannerImageUrl ?? undefined,
      todaySections: normalizeTodaySections(hub.todaySections),
      workersCanEdit: normalizeWorkersCanEdit(hub.workersCanEdit),
      ...(options.includeOrganizationMapping
        ? { clerkOrganizationId: hub.clerkOrganizationId }
        : {}),
    },
    ...(options.workerSections
      ? {
          guideReferences: allGuides
            .filter((guide) => guideReferenceIds.has(guide._id))
            .map((guide) => ({
              id: guide.slug,
              title: guide.title,
              published: guide.published,
            })),
          eventReferences: allEvents
            .filter((event) => eventReferenceIds.has(event._id))
            .map((event) => ({
              id: event.slug,
              title: event.title,
              published: event.published,
            })),
        }
      : {}),
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
          relatedGuideIds: relatedGuideIdsByGuideId.get(guide._id) ?? [],
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
      allDay: event.allDay ?? false,
      ...(event.startUtc ? { startUtc: event.startUtc } : {}),
      ...(event.endUtc ? { endUtc: event.endUtc } : {}),
      ...(event.icalUid ? { icalUid: event.icalUid } : {}),
      location: event.location,
      employees: (employeesByEventId.get(event._id) ?? []).map((employee) =>
        includeEventDrafts ? employee : { displayName: employee.displayName }
      ),
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
        ? announcementGuideSlugById.get(announcement.guideId)
        : undefined,
      eventId: announcement.eventId
        ? announcementEventSlugById.get(announcement.eventId)
        : undefined,
    })),
    faqs: allFaqs.map((faq) => ({
      id: faq.slug,
      question: faq.question,
      answer: faq.answer,
      order: faq.order,
    })),
    documents: await Promise.all(
      documents.map(async (document) => {
        const storedResource = document.resource
        const resource =
          storedResource.kind === "file"
            ? await ctx.storage.getUrl(storedResource.storageId).then((url) => {
                if (!url) throw new Error("documentFileNotFound")
                return {
                  kind: "file" as const,
                  name: storedResource.name,
                  contentType: storedResource.contentType,
                  size: storedResource.size,
                  url,
                }
              })
            : storedResource
        const bannerImageUrl = document.bannerStorageId
          ? await ctx.storage.getUrl(document.bannerStorageId)
          : null
        return {
          id: document.slug,
          title: document.title,
          description: document.description,
          resource,
          employees: (employeesByDocumentId.get(document._id) ?? []).map(
            (employee) =>
              includeDocumentDrafts
                ? employee
                : { displayName: employee.displayName }
          ),
          relatedGuideIds: guideIdsByDocumentId.get(document._id) ?? [],
          bannerImageUrl: bannerImageUrl ?? undefined,
          published: document.published,
          updatedAt: document.updatedAt,
        }
      })
    ),
  }
}
