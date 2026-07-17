import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

const accessMode = v.union(v.literal("public"), v.literal("restricted"))
const richTextDocument = v.object({
  type: v.literal("doc"),
  content: v.optional(v.array(v.any())),
})

export default defineSchema({
  hubs: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerSubject: v.string(),
    ownerTokenIdentifier: v.string(),
    accessMode,
    joinCodeHash: v.string(),
    privateTokenHash: v.string(),
    credentialVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerTokenIdentifier", ["ownerTokenIdentifier"]),

  categories: defineTable({
    hubId: v.id("hubs"),
    slug: v.string(),
    label: v.string(),
    iconKey: v.string(),
    description: v.string(),
    order: v.number(),
  })
    .index("by_hubId_and_order", ["hubId", "order"])
    .index("by_hubId_and_slug", ["hubId", "slug"]),

  guides: defineTable({
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    categoryId: v.id("categories"),
    duration: v.string(),
    updatedLabel: v.string(),
    featured: v.boolean(),
    published: v.boolean(),
    keywords: v.array(v.string()),
    content: richTextDocument,
  })
    .index("by_hubId_and_slug", ["hubId", "slug"])
    .index("by_hubId_and_published", ["hubId", "published"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["hubId", "published"],
    }),

  events: defineTable({
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    start: v.string(),
    end: v.string(),
    location: v.string(),
    owner: v.string(),
    notes: v.string(),
    published: v.boolean(),
  })
    .index("by_hubId_and_slug", ["hubId", "slug"])
    .index("by_hubId_and_start", ["hubId", "start"])
    .index("by_hubId_and_published", ["hubId", "published"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["hubId", "published"],
    }),

  eventGuides: defineTable({
    hubId: v.id("hubs"),
    eventId: v.id("events"),
    guideId: v.id("guides"),
  })
    .index("by_eventId", ["eventId"])
    .index("by_guideId", ["guideId"])
    .index("by_hubId", ["hubId"]),

  announcements: defineTable({
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
    guideId: v.optional(v.id("guides")),
    eventId: v.optional(v.id("events")),
  })
    .index("by_hubId_and_slug", ["hubId", "slug"])
    .index("by_hubId_and_published", ["hubId", "published"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["hubId", "published"],
    }),

  attachments: defineTable({
    hubId: v.id("hubs"),
    eventId: v.id("events"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_hubId", ["hubId"]),

  helpRequests: defineTable({
    hubId: v.id("hubs"),
    topic: v.string(),
    message: v.string(),
    submittedAt: v.number(),
    status: v.union(v.literal("open"), v.literal("resolved")),
  }).index("by_hubId_and_submittedAt", ["hubId", "submittedAt"]),
})
