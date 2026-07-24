import type { Category, Guide } from "@/lib/knowledge-base"
import {
  categories as knowledgeBaseCategories,
  commonQuestions,
  guides as knowledgeBaseGuides,
} from "@/lib/knowledge-base"
import type { RichTextDocument } from "@/lib/rich-text"
import { guideStepsToRichText, paragraphDocument } from "@/lib/rich-text"
import type { WorkspaceDocument } from "@/lib/documents"

export const eventCategories = [
  "Reservation",
  "Training",
  "Promotion",
  "Delivery",
  "Maintenance",
  "Inspection",
  "Opening hours",
] as const

export type EventCategory = (typeof eventCategories)[number]

export type Attachment = {
  id: string
  name: string
  contentType: string
  size: number
  url: string
}

export type CalendarEvent = {
  id: string
  title: string
  description: string
  category: EventCategory
  start: string
  end: string
  allDay: boolean
  startUtc?: string
  endUtc?: string
  location: string
  employees: Array<{ id?: string; displayName: string }>
  notes: string
  attachments: Attachment[]
  guideIds: string[]
  published: boolean
}

export type EmployeeStatus = "unclaimed" | "invited" | "active" | "deactivated"
export type EmployeeAccessLevel = "viewer" | "editor" | "manager"

export type EmployeeProfile = {
  id: string
  displayName: string
  email?: string
  department?: string
  jobTitle?: string
  status: EmployeeStatus
  accessLevel: EmployeeAccessLevel
  clerkUserId?: string
  invitationId?: string
  invitationStatus:
    "not-sent" | "pending" | "accepted" | "expired" | "revoked" | "failed"
  invitationError?: string
}

export type AnnouncementPriority = "Normal" | "Important" | "Urgent"

export type Announcement = {
  id: string
  title: string
  content: RichTextDocument
  publishedAt: string
  expiresAt: string
  priority: AnnouncementPriority
  pinned: boolean
  published: boolean
  guideId?: string
  eventId?: string
}

export type Faq = {
  id: string
  question: string
  answer: string
  order: number
  published: boolean
}

export type OperationsState = {
  categories: Category[]
  guides: Guide[]
  events: CalendarEvent[]
  announcements: Announcement[]
  faqs: Faq[]
  documents: WorkspaceDocument[]
}

export const HUB_TIME_ZONE = "Europe/Tallinn"

function dateParts(value: Date, timeZone = HUB_TIME_ZONE) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
}

function localWallTimeDate(value: string) {
  const [date, time = "00:00"] = value.split("T")
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  return new Date(Date.UTC(year, month - 1, day, hour, minute))
}

function atDate(offset: number, time = "09:00") {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  const [hours, minutes] = time.split(":").map(Number)
  date.setHours(hours, minutes, 0, 0)
  return toLocalDateTimeValue(date)
}

function dateOnly(offset: number) {
  return atDate(offset).slice(0, 10)
}

export function createSeedState(): OperationsState {
  return {
    categories: knowledgeBaseCategories.map((category) => ({ ...category })),
    guides: knowledgeBaseGuides.map(({ steps, ...guide }) => ({
      ...guide,
      content: guideStepsToRichText(steps),
      keywords: [...(guide.keywords ?? [])],
      published: true,
    })),
    events: [
      {
        id: "terrace-lunch",
        title: "Terrace group lunch",
        description:
          "A 28-person private lunch with a set menu and one allergy-safe course.",
        category: "Reservation",
        start: atDate(0, "12:30"),
        end: atDate(0, "15:00"),
        allDay: false,
        location: "Terrace",
        employees: [{ displayName: "Marta" }],
        notes:
          "Terrace closed to walk-ins from noon. Water and place cards should be ready by 12:00.",
        attachments: [],
        guideIds: ["allergy-request", "split-payment"],
        published: true,
      },
      {
        id: "coffee-training",
        title: "New coffee service training",
        description:
          "A short practical session covering the updated coffee workflow.",
        category: "Training",
        start: atDate(0, "16:00"),
        end: atDate(0, "17:00"),
        allDay: false,
        location: "Bar",
        employees: [{ displayName: "Joonas" }],
        notes: "The bar remains open. Training will use the left-hand machine.",
        attachments: [],
        guideIds: [],
        published: true,
      },
      {
        id: "produce-delivery",
        title: "Early produce delivery",
        description:
          "Friday produce arrives before the usual receiving window.",
        category: "Delivery",
        start: atDate(1, "07:30"),
        end: atDate(1, "08:15"),
        allDay: false,
        location: "Rear entrance",
        employees: [{ displayName: "Sofia" }],
        notes:
          "Keep the rear entrance clear and place cold items in storage first.",
        attachments: [],
        guideIds: [],
        published: true,
      },
      {
        id: "summer-menu",
        title: "Summer menu launch",
        description: "The seasonal food and drinks menu begins service.",
        category: "Promotion",
        start: atDate(3, "10:00"),
        end: atDate(3, "23:00"),
        allDay: false,
        location: "Whole venue",
        employees: [{ displayName: "Anu" }],
        notes:
          "Remove the old menu inserts before opening and check table talkers.",
        attachments: [],
        guideIds: ["allergy-request"],
        published: true,
      },
      {
        id: "dishwasher-service",
        title: "Dishwasher service visit",
        description:
          "Planned preventative maintenance for the main dishwasher.",
        category: "Maintenance",
        start: atDate(7, "08:00"),
        end: atDate(7, "10:30"),
        allDay: false,
        location: "Wash area",
        employees: [{ displayName: "Rasmus" }],
        notes: "Use the prep sink only if the engineer confirms it is safe.",
        attachments: [],
        guideIds: ["end-cleaning"],
        published: true,
      },
      {
        id: "fire-inspection",
        title: "Fire safety inspection",
        description: "Routine inspection of exits, extinguishers, and records.",
        category: "Inspection",
        start: atDate(12, "09:30"),
        end: atDate(12, "11:00"),
        allDay: false,
        location: "Whole venue",
        employees: [{ displayName: "Marta" }],
        notes: "Keep all corridors and exits fully clear before opening.",
        attachments: [],
        guideIds: ["cash-safety"],
        published: true,
      },
      {
        id: "draft-tasting",
        title: "Supplier tasting",
        description: "Internal tasting time awaiting supplier confirmation.",
        category: "Promotion",
        start: atDate(5, "14:00"),
        end: atDate(5, "15:00"),
        allDay: false,
        location: "Private room",
        employees: [{ displayName: "Anu" }],
        notes: "Draft only.",
        attachments: [],
        guideIds: [],
        published: false,
      },
    ],
    announcements: [
      {
        id: "terrace-entrance",
        title: "Use the side entrance for terrace deliveries",
        content: paragraphDocument(
          "The main terrace gate is reserved for today’s group. Please direct deliveries to the marked side entrance."
        ),
        publishedAt: dateOnly(-1),
        expiresAt: dateOnly(1),
        priority: "Important",
        pinned: true,
        published: true,
        eventId: "terrace-lunch",
      },
      {
        id: "card-terminal",
        title: "Bar card terminal is back in service",
        content: paragraphDocument(
          "The replacement terminal is installed and can be used normally. Report any connection issue to the shift lead."
        ),
        publishedAt: dateOnly(0),
        expiresAt: dateOnly(4),
        priority: "Normal",
        pinned: false,
        published: true,
        guideId: "split-payment",
      },
      {
        id: "menu-briefing",
        title: "Summer menu briefing coming up",
        content: paragraphDocument(
          "Read the menu notes before the launch and bring allergen questions to the pre-shift briefing."
        ),
        publishedAt: dateOnly(2),
        expiresAt: dateOnly(8),
        priority: "Normal",
        pinned: false,
        published: true,
        eventId: "summer-menu",
        guideId: "allergy-request",
      },
      {
        id: "old-repair",
        title: "Ice machine repair completed",
        content: paragraphDocument(
          "The repair is complete and the machine is operating normally."
        ),
        publishedAt: dateOnly(-12),
        expiresAt: dateOnly(-3),
        priority: "Normal",
        pinned: false,
        published: true,
      },
      {
        id: "draft-note",
        title: "Draft supplier note",
        content: paragraphDocument("Waiting for delivery confirmation."),
        publishedAt: dateOnly(1),
        expiresAt: dateOnly(5),
        priority: "Normal",
        pinned: false,
        published: false,
      },
    ],
    faqs: commonQuestions.map((faq, order) => ({
      id: slugify(faq.question),
      question: faq.question,
      answer: faq.answer,
      order,
      published: true,
    })),
    documents: [],
  }
}

export function toLocalDateTimeValue(date: Date) {
  const parts = dateParts(date)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function toDateKey(value: string | Date, timeZone = HUB_TIME_ZONE) {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(value) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  ) {
    return value.slice(0, 10)
  }
  const parts = dateParts(
    typeof value === "string" ? new Date(value) : value,
    timeZone
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function endOfToday() {
  const date = startOfToday()
  date.setHours(23, 59, 59, 999)
  return date
}

export function isAnnouncementActive(
  announcement: Announcement,
  now = new Date(),
  timeZone = HUB_TIME_ZONE
) {
  const today = toDateKey(now, timeZone)
  return (
    announcement.published &&
    announcement.publishedAt <= today &&
    announcement.expiresAt >= today
  )
}

export function getAnnouncementState(
  announcement: Announcement,
  now = new Date(),
  timeZone = HUB_TIME_ZONE
) {
  if (!announcement.published) return "Draft"
  const today = toDateKey(now, timeZone)
  if (announcement.publishedAt > today) return "Upcoming"
  if (announcement.expiresAt < today) return "Expired"
  return "Active"
}

export function formatDate(
  value: string,
  options?: Intl.DateTimeFormatOptions,
  timeZone = HUB_TIME_ZONE
) {
  const isWallTime =
    /^\d{4}-\d{2}-\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  return new Intl.DateTimeFormat("en-GB", {
    ...(options ?? { weekday: "short", day: "numeric", month: "short" }),
    timeZone: isWallTime ? "UTC" : timeZone,
  }).format(isWallTime ? localWallTimeDate(value) : new Date(value))
}

export function formatTime(value: string, timeZone = HUB_TIME_ZONE) {
  const isWallTime =
    /^\d{4}-\d{2}-\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: isWallTime ? "UTC" : timeZone,
  }).format(isWallTime ? localWallTimeDate(value) : new Date(value))
}

export function formatEventTime(event: CalendarEvent) {
  return event.allDay
    ? "All day"
    : `${formatTime(event.start)}–${formatTime(event.end)}`
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function normalizeReadingTime(value: string) {
  const readingTime = value.trim()
  return /^\d+(?:[.,]\d+)?$/.test(readingTime)
    ? `${readingTime} min`
    : readingTime
}
