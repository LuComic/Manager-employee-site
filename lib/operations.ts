import type { Guide } from "@/lib/knowledge-base"
import { guides as knowledgeBaseGuides } from "@/lib/knowledge-base"

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

export type CalendarEvent = {
  id: string
  title: string
  description: string
  category: EventCategory
  start: string
  end: string
  location: string
  owner: string
  notes: string
  attachments: string[]
  guideIds: string[]
  published: boolean
}

export type AnnouncementPriority = "Normal" | "Important" | "Urgent"

export type Announcement = {
  id: string
  title: string
  message: string
  publishedAt: string
  expiresAt: string
  priority: AnnouncementPriority
  pinned: boolean
  published: boolean
  guideId?: string
  eventId?: string
}

export type OperationsState = {
  guides: Guide[]
  events: CalendarEvent[]
  announcements: Announcement[]
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
    guides: knowledgeBaseGuides.map((guide) => ({
      ...guide,
      steps: guide.steps.map((step) => ({ ...step })),
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
        location: "Terrace",
        owner: "Marta",
        notes:
          "Terrace closed to walk-ins from noon. Water and place cards should be ready by 12:00.",
        attachments: ["Terrace seating plan.pdf", "Set lunch menu.pdf"],
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
        location: "Bar",
        owner: "Joonas",
        notes: "The bar remains open. Training will use the left-hand machine.",
        attachments: ["Coffee quick reference.pdf"],
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
        location: "Rear entrance",
        owner: "Sofia",
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
        location: "Whole venue",
        owner: "Anu",
        notes:
          "Remove the old menu inserts before opening and check table talkers.",
        attachments: ["Summer menu notes.pdf"],
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
        location: "Wash area",
        owner: "Rasmus",
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
        location: "Whole venue",
        owner: "Marta",
        notes: "Keep all corridors and exits fully clear before opening.",
        attachments: ["Inspection preparation.pdf"],
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
        location: "Private room",
        owner: "Anu",
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
        message:
          "The main terrace gate is reserved for today’s group. Please direct deliveries to the marked side entrance.",
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
        message:
          "The replacement terminal is installed and can be used normally. Report any connection issue to the shift lead.",
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
        message:
          "Read the menu notes before the launch and bring allergen questions to the pre-shift briefing.",
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
        message:
          "The repair is complete and the machine is operating normally.",
        publishedAt: dateOnly(-12),
        expiresAt: dateOnly(-3),
        priority: "Normal",
        pinned: false,
        published: true,
      },
      {
        id: "draft-note",
        title: "Draft supplier note",
        message: "Waiting for delivery confirmation.",
        publishedAt: dateOnly(1),
        expiresAt: dateOnly(5),
        priority: "Normal",
        pinned: false,
        published: false,
      },
    ],
  }
}

export function toLocalDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function toDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
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
  now = new Date()
) {
  const start = new Date(`${announcement.publishedAt}T00:00:00`)
  const end = new Date(`${announcement.expiresAt}T23:59:59`)
  return announcement.published && start <= now && end >= now
}

export function getAnnouncementState(
  announcement: Announcement,
  now = new Date()
) {
  if (!announcement.published) return "Draft"
  if (new Date(`${announcement.publishedAt}T00:00:00`) > now) return "Upcoming"
  if (new Date(`${announcement.expiresAt}T23:59:59`) < now) return "Expired"
  return "Active"
}

export function formatDate(
  value: string,
  options?: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    options ?? { weekday: "short", day: "numeric", month: "short" }
  ).format(new Date(value))
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
