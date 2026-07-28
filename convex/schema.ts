import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

import { hubStorageBindingValidator } from "./lib/hubStorage"

const accessMode = v.union(v.literal("public"), v.literal("restricted"))
const employeeStatus = v.union(
  v.literal("unclaimed"),
  v.literal("invited"),
  v.literal("active"),
  v.literal("deactivated")
)
const employeeAccessLevel = v.union(
  v.literal("viewer"),
  v.literal("editor"),
  v.literal("manager")
)
const invitationStatus = v.union(
  v.literal("not-sent"),
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("expired"),
  v.literal("revoked"),
  v.literal("failed")
)
const todaySectionKey = v.union(
  v.literal("welcome"),
  v.literal("quick-links"),
  v.literal("happening-today"),
  v.literal("current-announcements"),
  v.literal("coming-next"),
  v.literal("useful-guides")
)
const todaySection = v.object({
  key: todaySectionKey,
  visible: v.boolean(),
})
const richTextDocument = v.object({
  type: v.literal("doc"),
  content: v.optional(v.array(v.any())),
})
const documentResource = v.union(
  v.object({
    kind: v.literal("file"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
  }),
  v.object({
    kind: v.literal("link"),
    url: v.string(),
  })
)

export default defineSchema({
  hubs: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    timeZone: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    bannerStorageId: v.optional(v.id("_storage")),
    todaySections: v.optional(v.array(todaySection)),
    clerkOrganizationId: v.string(),
    accessMode,
    joinCodeHash: v.string(),
    privateTokenHash: v.string(),
    credentialVersion: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_clerkOrganizationId", ["clerkOrganizationId"]),

  employeeProfiles: defineTable({
    hubId: v.id("hubs"),
    clerkUserId: v.optional(v.string()),
    displayName: v.string(),
    email: v.optional(v.string()),
    normalizedEmail: v.optional(v.string()),
    department: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    status: employeeStatus,
    // Missing values are treated as read-only.
    accessLevel: v.optional(employeeAccessLevel),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    invitedAt: v.optional(v.number()),
    activatedAt: v.optional(v.number()),
    deactivatedAt: v.optional(v.number()),
    invitationId: v.optional(v.string()),
    invitationStatus: invitationStatus,
    invitationCorrelationHash: v.optional(v.string()),
    invitationError: v.optional(v.string()),
  })
    .index("by_hubId_and_displayName", ["hubId", "displayName"])
    .index("by_hubId_and_clerkUserId", ["hubId", "clerkUserId"])
    .index("by_hubId_and_normalizedEmail", ["hubId", "normalizedEmail"])
    .index("by_invitationCorrelationHash", ["invitationCorrelationHash"])
    .index("by_invitationId", ["invitationId"]),

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
    .index("by_categoryId", ["categoryId"])
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
    allDay: v.optional(v.boolean()),
    startUtc: v.optional(v.string()),
    endUtc: v.optional(v.string()),
    icalUid: v.optional(v.string()),
    location: v.string(),
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

  eventEmployees: defineTable({
    hubId: v.id("hubs"),
    eventId: v.id("events"),
    employeeProfileId: v.id("employeeProfiles"),
    addedAt: v.number(),
    addedBy: v.string(),
  })
    .index("by_eventId_and_employeeProfileId", ["eventId", "employeeProfileId"])
    .index("by_employeeProfileId_and_eventId", ["employeeProfileId", "eventId"])
    .index("by_hubId_and_eventId", ["hubId", "eventId"]),

  clerkWebhookEvents: defineTable({
    eventId: v.string(),
    eventType: v.string(),
    receivedAt: v.number(),
  }).index("by_eventId", ["eventId"]),

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
    .index("by_guideId", ["guideId"])
    .index("by_eventId", ["eventId"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["hubId", "published"],
    }),

  faqs: defineTable({
    hubId: v.id("hubs"),
    slug: v.string(),
    question: v.string(),
    answer: v.string(),
    order: v.number(),
    published: v.boolean(),
  })
    .index("by_hubId_and_order", ["hubId", "order"])
    .index("by_hubId_and_slug", ["hubId", "slug"]),

  documents: defineTable({
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    resource: documentResource,
    bannerStorageId: v.optional(v.id("_storage")),
    published: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_hubId_and_slug", ["hubId", "slug"])
    .index("by_hubId_and_published", ["hubId", "published"])
    .index("by_hubId_and_updatedAt", ["hubId", "updatedAt"])
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["hubId", "published"],
    }),

  documentEmployees: defineTable({
    hubId: v.id("hubs"),
    documentId: v.id("documents"),
    employeeProfileId: v.id("employeeProfiles"),
    addedAt: v.number(),
    addedBy: v.string(),
  })
    .index("by_documentId_and_employeeProfileId", [
      "documentId",
      "employeeProfileId",
    ])
    .index("by_employeeProfileId_and_documentId", [
      "employeeProfileId",
      "documentId",
    ])
    .index("by_hubId_and_documentId", ["hubId", "documentId"]),

  uploadIntents: defineTable({
    hubId: v.id("hubs"),
    requestedBy: v.string(),
    sha256: v.string(),
    size: v.number(),
    createdAt: v.number(),
  }),

  hubStorage: defineTable({
    hubId: v.id("hubs"),
    storageId: v.id("_storage"),
    uploadedBy: v.string(),
    createdAt: v.number(),
    binding: v.optional(hubStorageBindingValidator),
  }).index("by_storageId", ["storageId"]),

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

  workerNotes: defineTable({
    hubId: v.id("hubs"),
    text: v.string(),
    pinned: v.boolean(),
    createdBy: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_hubId_and_pinned", ["hubId", "pinned"])
    .index("by_hubId_and_pinned_and_expiresAt", [
      "hubId",
      "pinned",
      "expiresAt",
    ]),

  notifications: defineTable({
    hubId: v.id("hubs"),
    audience: v.union(
      v.literal("employees"),
      v.literal("managers"),
      v.literal("employee")
    ),
    employeeProfileId: v.optional(v.id("employeeProfiles")),
    kind: v.union(
      v.literal("guide"),
      v.literal("event"),
      v.literal("announcement"),
      v.literal("document"),
      v.literal("question"),
      v.literal("workplace")
    ),
    // Transitional: existing development rows may still use rendered copy.
    title: v.optional(v.string()),
    message: v.optional(v.string()),
    titleKey: v.optional(v.string()),
    messageKey: v.optional(v.string()),
    messageValues: v.optional(
      v.record(v.string(), v.union(v.string(), v.number()))
    ),
    href: v.string(),
    // Transitional: older notification rows stored this redundantly.
    createdAt: v.optional(v.number()),
  })
    .index("by_hubId_and_audience", ["hubId", "audience"])
    .index("by_employeeProfileId", ["employeeProfileId"]),

  notificationReadStates: defineTable({
    hubId: v.id("hubs"),
    employeeProfileId: v.optional(v.id("employeeProfiles")),
    viewerKey: v.string(),
    viewerType: v.union(v.literal("employee"), v.literal("manager")),
    lastReadAt: v.number(),
  })
    .index("by_hubId_and_viewerKey_and_viewerType", [
      "hubId",
      "viewerKey",
      "viewerType",
    ])
    .index("by_employeeProfileId", ["employeeProfileId"]),
})
