import type { Category, Guide } from "@/lib/knowledge-base"
import type { RichTextDocument } from "@/lib/rich-text"
import type { WorkspaceDocument } from "@/lib/documents"
import type { AppMessageKey } from "@/i18n/messages"

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
  category: string
  start: string
  end: string
  allDay: boolean
  startUtc?: string
  endUtc?: string
  icalUid?: string
  location: string
  employees: Array<{ id?: string; displayName: string }>
  notes: string
  attachments: Attachment[]
  guideIds: string[]
  published: boolean
  isPrivate?: boolean
  source?: "deputy"
}

export const PRIVATE_EVENT_FILTER = "__private__"

export function eventMatchesFilter(
  event: Pick<CalendarEvent, "category" | "isPrivate">,
  filter: string
) {
  if (filter === "All") return true
  if (filter === PRIVATE_EVENT_FILTER) return Boolean(event.isPrivate)
  return event.category === filter
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

export type ContentReference = {
  id: string
  title: string
  published: boolean
}

export const announcementPriorityMessageKeys = {
  Normal: "normal",
  Important: "important",
  Urgent: "urgent",
} satisfies Record<AnnouncementPriority, AppMessageKey>

export const announcementStateMessageKeys = {
  Draft: "draft",
  Upcoming: "upcoming",
  Expired: "expired",
  Active: "active",
} satisfies Record<ReturnType<typeof getAnnouncementState>, AppMessageKey>

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

export function addCalendarDays(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ""
  const [year, month, day] = value.split("-").map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

export function addHoursToLocalDateTime(value: string, hours: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return ""
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const initial = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (
    initial.getUTCFullYear() !== year ||
    initial.getUTCMonth() !== month - 1 ||
    initial.getUTCDate() !== day ||
    initial.getUTCHours() !== hour ||
    initial.getUTCMinutes() !== minute
  ) {
    return ""
  }
  return new Date(initial.getTime() + hours * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
}

export function eventLastDateKey(event: CalendarEvent) {
  const startKey = event.start.slice(0, 10)
  const endKey = event.end.slice(0, 10)
  const endsAtMidnight = event.end.slice(11, 16) === "00:00"
  const lastKey =
    event.allDay || endsAtMidnight ? addCalendarDays(endKey, -1) : endKey
  return lastKey < startKey ? startKey : lastKey
}

export function eventOccursOnDate(event: CalendarEvent, dateKey: string) {
  return (
    event.start.slice(0, 10) <= dateKey && eventLastDateKey(event) >= dateKey
  )
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
  timeZone = HUB_TIME_ZONE,
  locale = "en-GB"
) {
  const isWallTime =
    /^\d{4}-\d{2}-\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  return new Intl.DateTimeFormat(locale, {
    ...(options ?? { weekday: "short", day: "numeric", month: "short" }),
    timeZone: isWallTime ? "UTC" : timeZone,
  }).format(isWallTime ? localWallTimeDate(value) : new Date(value))
}

export function formatTime(
  value: string,
  timeZone = HUB_TIME_ZONE,
  locale = "en-GB"
) {
  const isWallTime =
    /^\d{4}-\d{2}-\d{2}/.test(value) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: isWallTime ? "UTC" : timeZone,
  }).format(isWallTime ? localWallTimeDate(value) : new Date(value))
}

export function formatEventDate(
  event: CalendarEvent,
  options?: Intl.DateTimeFormatOptions,
  timeZone = HUB_TIME_ZONE,
  locale = "en-GB"
) {
  const startKey = event.start.slice(0, 10)
  const lastKey = eventLastDateKey(event)
  const start = formatDate(event.start, options, timeZone, locale)
  return startKey === lastKey
    ? start
    : `${start}–${formatDate(`${lastKey}T00:00`, options, timeZone, locale)}`
}

export function formatEventTime(
  event: CalendarEvent,
  timeZone = HUB_TIME_ZONE,
  locale = "en-GB",
  allDayLabel = "All day"
) {
  if (event.allDay) return allDayLabel
  if (event.startUtc && event.endUtc) {
    const startZone = formatTimeZoneName(event.startUtc, timeZone, locale)
    const endZone = formatTimeZoneName(event.endUtc, timeZone, locale)
    if (event.end <= event.start || startZone !== endZone) {
      return `${formatTime(event.startUtc, timeZone, locale)} ${startZone}–${formatTime(
        event.endUtc,
        timeZone,
        locale
      )} ${endZone}`
    }
  }
  return `${formatTime(event.start, timeZone, locale)}–${formatTime(
    event.end,
    timeZone,
    locale
  )}`
}

function formatTimeZoneName(value: string, timeZone: string, locale: string) {
  return (
    new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(new Date(value))
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone
  )
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
