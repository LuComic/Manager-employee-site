import { v } from "convex/values"

import { query } from "./_generated/server"
import { canReadPublishedHub } from "./lib/access"

function plainText(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(plainText).join(" ")
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return [record.text, record.content].map(plainText).join(" ")
  }
  return ""
}

function includes(queryText: string, ...values: unknown[]) {
  return values.map(plainText).join(" ").toLocaleLowerCase().includes(queryText)
}

export const published = query({
  args: {
    hubSlug: v.string(),
    credential: v.optional(v.string()),
    query: v.string(),
    nowDate: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_slug", (q) => q.eq("slug", args.hubSlug))
      .unique()
    if (!hub || !(await canReadPublishedHub(ctx, hub, args.credential)))
      return []
    const cleanQuery = args.query.trim().toLocaleLowerCase().slice(0, 120)
    if (!cleanQuery) return []

    const [
      categories,
      guides,
      events,
      announcements,
      faqs,
      documents,
      eventEmployees,
      documentEmployees,
      employeeProfiles,
    ] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hub._id))
        .take(500),
      ctx.db
        .query("guides")
        .withIndex("by_hubId_and_published", (q) =>
          q.eq("hubId", hub._id).eq("published", true)
        )
        .take(500),
      ctx.db
        .query("events")
        .withIndex("by_hubId_and_published", (q) =>
          q.eq("hubId", hub._id).eq("published", true)
        )
        .take(500),
      ctx.db
        .query("announcements")
        .withIndex("by_hubId_and_published", (q) =>
          q.eq("hubId", hub._id).eq("published", true)
        )
        .take(500),
      ctx.db
        .query("faqs")
        .withIndex("by_hubId_and_order", (q) => q.eq("hubId", hub._id))
        .take(500),
      ctx.db
        .query("documents")
        .withIndex("by_hubId_and_published", (q) =>
          q.eq("hubId", hub._id).eq("published", true)
        )
        .take(500),
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
    const categoryById = new Map(
      categories.map((category) => [category._id, category.label])
    )
    const employeeNameById = new Map(
      employeeProfiles.map((profile) => [profile._id, profile.displayName])
    )
    const employeeNamesByEventId = new Map<string, string[]>()
    for (const relation of eventEmployees) {
      const name = employeeNameById.get(relation.employeeProfileId)
      if (!name) continue
      const current = employeeNamesByEventId.get(relation.eventId) ?? []
      current.push(name)
      employeeNamesByEventId.set(relation.eventId, current)
    }
    const employeeNamesByDocumentId = new Map<string, string[]>()
    for (const relation of documentEmployees) {
      const name = employeeNameById.get(relation.employeeProfileId)
      if (!name) continue
      const current = employeeNamesByDocumentId.get(relation.documentId) ?? []
      current.push(name)
      employeeNamesByDocumentId.set(relation.documentId, current)
    }

    return [
      ...guides
        .filter((guide) =>
          includes(
            cleanQuery,
            guide.title,
            guide.description,
            guide.keywords,
            guide.content,
            categoryById.get(guide.categoryId)
          )
        )
        .map((guide) => ({
          id: guide.slug,
          href: `/guides/${guide.slug}`,
          title: guide.title,
          description: guide.description,
          type: "Guide" as const,
        })),
      ...events
        .filter((event) =>
          includes(
            cleanQuery,
            event.title,
            event.description,
            event.category,
            event.location,
            employeeNamesByEventId.get(event._id),
            event.notes
          )
        )
        .map((event) => ({
          id: event.slug,
          href: `/calendar/${event.slug}`,
          title: event.title,
          description: event.description,
          type: "Event" as const,
        })),
      ...announcements
        .filter(
          (announcement) =>
            announcement.expiresAt >= args.nowDate &&
            includes(
              cleanQuery,
              announcement.title,
              announcement.content,
              announcement.priority
            )
        )
        .map((announcement) => ({
          id: announcement.slug,
          href: `/announcements/${announcement.slug}`,
          title: announcement.title,
          description: plainText(announcement.content).trim(),
          type: "Announcement" as const,
        })),
      ...faqs
        .filter((faq) => includes(cleanQuery, faq.question, faq.answer))
        .map((faq) => ({
          id: faq.slug,
          href: `/questions#${faq.slug}`,
          title: faq.question,
          description: faq.answer,
          type: "Question" as const,
        })),
      ...documents
        .filter((document) =>
          includes(
            cleanQuery,
            document.title,
            document.description,
            document.resource?.kind === "file"
              ? [
                  document.resource.name,
                  document.resource.contentType,
                  employeeNamesByDocumentId.get(document._id),
                ]
              : [
                  document.resource?.url,
                  employeeNamesByDocumentId.get(document._id),
                ]
          )
        )
        .map((document) => ({
          id: document.slug,
          href: `/documents/${document.slug}`,
          title: document.title,
          description: document.description,
          type: "Document" as const,
        })),
    ].slice(0, 30)
  },
})
