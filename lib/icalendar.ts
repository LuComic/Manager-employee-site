import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"
import ICAL from "ical.js"

import { SITE_NAME } from "@/lib/branding"
import {
  addCalendarDays,
  eventCategories,
  slugify,
  type CalendarEvent,
  type EventCategory,
} from "@/lib/operations"

export const MAX_IMPORTED_EVENTS = 25
export const MAX_ICALENDAR_FILE_SIZE_BYTES = 1024 * 1024
const EVENT_TITLE_LIMIT = 140
const EVENT_DESCRIPTION_LIMIT = 500
const EVENT_LOCATION_LIMIT = 140
const EVENT_NOTES_LIMIT = 4000
const ICALENDAR_UID_LIMIT = 512
const OPERATIONS_UID_DOMAIN = `${SITE_NAME}.local`

type CalendarOptions = {
  calendarName: string
  timeZone: string
  uidDomain?: string
  now?: Date
}

type ImportOptions = {
  timeZone: string
  published?: boolean
}

export type CalendarImportIssue = {
  severity: "error" | "warning"
  message: string
}

export type CalendarImportResult = {
  events: CalendarEvent[]
  cancellations: CalendarCancellation[]
  issues: CalendarImportIssue[]
}

export type CalendarCancellation = {
  id: string
  title: string
}

type ParsedCalendarDate = {
  local: string
  instant: Date
  allDay: boolean
  sourceTimeZone?: string
}

export function serializeICalendar(
  events: CalendarEvent[],
  {
    calendarName,
    timeZone,
    uidDomain = OPERATIONS_UID_DOMAIN,
    now = new Date(),
  }: CalendarOptions
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE_NAME}//Shared Calendar//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${escapeText(timeZone)}`,
    ...events.flatMap((event) =>
      serializeEvent(event, timeZone, uidDomain, now)
    ),
    "END:VCALENDAR",
  ]

  return `${lines.map(foldLine).join("\r\n")}\r\n`
}

export function parseICalendar(
  source: string,
  { timeZone, published = false }: ImportOptions
): CalendarImportResult {
  const issues: CalendarImportIssue[] = []
  let calendar: ICAL.Component
  try {
    calendar = new ICAL.Component(ICAL.parse(source))
  } catch {
    return {
      events: [],
      cancellations: [],
      issues: [
        {
          severity: "error",
          message: "This file is not valid iCalendar data.",
        },
      ],
    }
  }
  const eventComponents = calendar.getAllSubcomponents("vevent")

  if (!eventComponents.length) {
    return {
      events: [],
      cancellations: [],
      issues: [
        {
          severity: "error",
          message: "This file does not contain any calendar events.",
        },
      ],
    }
  }

  if (eventComponents.length > MAX_IMPORTED_EVENTS) {
    issues.push({
      severity: "warning",
      message: `Only the first ${MAX_IMPORTED_EVENTS} events were read from this file.`,
    })
  }

  const events: CalendarEvent[] = []
  const cancellations: CalendarCancellation[] = []
  const seenIds = new Set<string>()

  for (const [index, component] of eventComponents
    .slice(0, MAX_IMPORTED_EVENTS)
    .entries()) {
    try {
      const status = textValue(component, "status").toUpperCase()
      if (status === "CANCELLED") {
        const cancellation = parseCancellation(component)
        if (seenIds.has(cancellation.id)) {
          throw new Error(
            `“${cancellation.title}” has the same calendar identity as another event in this file.`
          )
        }
        seenIds.add(cancellation.id)
        cancellations.push(cancellation)
        continue
      }

      const eventWarnings: string[] = []
      const event = parseEvent(
        component,
        calendar,
        timeZone,
        published,
        (message) => eventWarnings.push(message)
      )
      if (seenIds.has(event.id)) {
        throw new Error(
          `“${event.title}” has the same calendar identity as another event in this file.`
        )
      }
      seenIds.add(event.id)
      events.push(event)

      if (component.hasProperty("rrule")) {
        eventWarnings.push(
          "is recurring and was imported as a single event; recurrence rules are not expanded."
        )
      }
      for (const message of eventWarnings) {
        issues.push({
          severity: "warning",
          message: `Event ${index + 1}: “${event.title}” ${message}`,
        })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The event is invalid."
      issues.push({
        severity: "error",
        message: `Event ${index + 1}: ${message}`,
      })
    }
  }

  return { events, cancellations, issues }
}

export function mergeImportedEvent(
  imported: CalendarEvent,
  existing: CalendarEvent | undefined,
  publishImported: boolean
): CalendarEvent {
  if (!existing) {
    return {
      ...imported,
      published: publishImported || imported.published,
    }
  }

  return {
    ...imported,
    id: existing.id,
    category: existing.category,
    employees: existing.employees,
    notes: existing.notes,
    attachments: existing.attachments,
    guideIds: existing.guideIds,
    published: publishImported || existing.published,
  }
}

export function calendarFileName(value: string) {
  const normalized = value.normalize("NFKD").replace(/\p{M}/gu, "")
  return `${slugify(normalized) || "calendar"}.ics`
}

function serializeEvent(
  event: CalendarEvent,
  timeZone: string,
  uidDomain: string,
  now: Date
) {
  const calendarDescription = [event.description, event.notes]
    .filter(Boolean)
    .join("\n\nNotes:\n")
  const uid =
    event.icalUid ||
    `${stableEventHash(event.id)}@${
      safeUid(uidDomain) || OPERATIONS_UID_DOMAIN
    }`
  const dates = event.allDay
    ? [
        `DTSTART;VALUE=DATE:${formatDateValue(event.start)}`,
        `DTEND;VALUE=DATE:${formatDateValue(event.end)}`,
      ]
    : [
        `DTSTART:${formatUtcDate(
          eventInstant(event.start, event.startUtc, timeZone)
        )}`,
        `DTEND:${formatUtcDate(
          eventInstant(event.end, event.endUtc, timeZone)
        )}`,
      ]

  return [
    "BEGIN:VEVENT",
    `UID:${escapeText(uid)}`,
    `DTSTAMP:${formatUtcDate(now)}`,
    `X-OPERATIONS-HUB-ID:${escapeText(event.id)}`,
    ...dates,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(calendarDescription)}`,
    `X-OPERATIONS-HUB-DESCRIPTION:${escapeText(event.description)}`,
    `X-OPERATIONS-HUB-NOTES:${escapeText(event.notes)}`,
    `LOCATION:${escapeText(event.location)}`,
    `CATEGORIES:${escapeText(event.category)}`,
    `STATUS:${event.published ? "CONFIRMED" : "TENTATIVE"}`,
    "END:VEVENT",
  ]
}

function parseEvent(
  component: ICAL.Component,
  calendar: ICAL.Component,
  targetTimeZone: string,
  published: boolean,
  warn: (message: string) => void
): CalendarEvent {
  const summary = textValue(component, "summary").trim()
  const startProperty = component.getFirstProperty("dtstart")
  const endProperty = component.getFirstProperty("dtend")

  if (!summary) throw new Error("Missing an event title.")
  if (summary.length > EVENT_TITLE_LIMIT) {
    throw new Error(
      `“${summary.slice(0, 60)}…” failed because its title is ${summary.length} characters; the maximum is ${EVENT_TITLE_LIMIT}.`
    )
  }
  if (!startProperty) throw new Error(`“${summary}” is missing a start date.`)

  const start = parseCalendarDate(startProperty, calendar, targetTimeZone)
  let end: ParsedCalendarDate
  if (endProperty) {
    end = parseCalendarDate(endProperty, calendar, targetTimeZone)
  } else if (component.hasProperty("duration")) {
    const calculatedEnd = new ICAL.Event(component).endDate
    end = parseCalendarTime(
      calculatedEnd,
      start.sourceTimeZone,
      calendar,
      targetTimeZone
    )
  } else if (start.allDay) {
    const local = `${addCalendarDays(start.local.slice(0, 10), 1)}T00:00`
    end = {
      local,
      instant: zonedDateTimeToDate(`${local}:00`, targetTimeZone),
      allDay: true,
    }
    warn("had no end date, so it was set to the next day.")
  } else {
    const instant = new Date(start.instant.getTime() + 60 * 60 * 1000)
    end = {
      local: formatInTimeZone(instant, targetTimeZone),
      instant,
      allDay: false,
    }
    warn("had no end time, so a one-hour duration was used.")
  }

  if (start.allDay !== end.allDay) {
    throw new Error(
      `“${summary}” mixes an all-day date with a timed date and cannot be imported safely.`
    )
  }
  if (end.instant.getTime() <= start.instant.getTime()) {
    throw new Error(`“${summary}” ends before it starts.`)
  }

  const structuredDescription = textValue(
    component,
    "x-operations-hub-description"
  ).trim()
  const rawDescription = (
    structuredDescription || textValue(component, "description")
  ).trim()
  const description = rawDescription || "Imported from an external calendar."
  if (!rawDescription) {
    warn("had no description, so an import note was added.")
  }
  if (description.length > EVENT_DESCRIPTION_LIMIT) {
    throw new Error(
      `“${summary}” failed because its description is ${description.length} characters; the maximum is ${EVENT_DESCRIPTION_LIMIT}.`
    )
  }

  const rawNotes = textValue(component, "x-operations-hub-notes").trim()
  const notes =
    rawNotes.length > EVENT_NOTES_LIMIT
      ? rawNotes.slice(0, EVENT_NOTES_LIMIT)
      : rawNotes
  if (rawNotes.length > EVENT_NOTES_LIMIT) {
    warn(
      `had notes longer than ${EVENT_NOTES_LIMIT} characters, so they were shortened.`
    )
  }

  const rawLocation = textValue(component, "location").trim()
  const location = rawLocation || "No location specified"
  if (!rawLocation) {
    warn("had no location, so “No location specified” was used.")
  }
  if (location.length > EVENT_LOCATION_LIMIT) {
    throw new Error(
      `“${summary}” failed because its location is ${location.length} characters; the maximum is ${EVENT_LOCATION_LIMIT}.`
    )
  }

  const rawCategories = textValue(component, "categories")
  const category = matchCategory(rawCategories)
  if (!category.matched) {
    warn(
      rawCategories.trim()
        ? `used an unsupported category, so “${category.value}” was used; an existing manager category will still be preserved on re-import.`
        : `had no category, so “${category.value}” was used.`
    )
  }

  const uid = normalizedUid(component)
  const recurrenceId = recurrenceIdentity(component)
  const id = calendarEventId(component, uid, recurrenceId, {
    summary,
    start,
    end,
  })
  if (!uid) {
    warn(
      "had no UID, so a stable identity was derived from its title and dates; changing those externally may create a new event."
    )
  }

  return {
    id,
    title: summary,
    description,
    category: category.value,
    start: start.local,
    end: end.local,
    allDay: start.allDay,
    ...(start.allDay
      ? {}
      : {
          startUtc: start.instant.toISOString(),
          endUtc: end.instant.toISOString(),
        }),
    location,
    employees: [],
    notes,
    attachments: [],
    guideIds: [],
    published,
    ...(uid && !recurrenceId ? { icalUid: uid } : {}),
  }
}

function parseCancellation(component: ICAL.Component): CalendarCancellation {
  const uid = normalizedUid(component)
  if (!uid) {
    throw new Error("A cancelled event is missing its calendar UID.")
  }
  const title = textValue(component, "summary").trim() || "Cancelled event"
  const recurrenceId = recurrenceIdentity(component)
  return {
    id: calendarEventId(component, uid, recurrenceId),
    title,
  }
}

function calendarEventId(
  component: ICAL.Component,
  uid: string | undefined,
  recurrenceId: string,
  fallback?: {
    summary: string
    start: ParsedCalendarDate
    end: ParsedCalendarDate
  }
) {
  const operationsId = textValue(component, "x-operations-hub-id").trim()
  const expectedUidPrefix = operationsId
    ? `${stableEventHash(operationsId)}@`
    : ""
  if (
    operationsId.length <= 100 &&
    /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(operationsId) &&
    uid?.startsWith(expectedUidPrefix) &&
    !recurrenceId
  ) {
    return operationsId
  }

  if (uid) {
    return `external-${stableEventHash(
      `uid:${uid}\u0000recurrence:${recurrenceId}`
    )}`
  }
  if (!fallback) {
    throw new Error("The event has no stable calendar identity.")
  }
  return `external-${stableEventHash(
    `fallback:${fallback.summary}\u0000${fallback.start.instant.toISOString()}\u0000${fallback.end.instant.toISOString()}`
  )}`
}

function normalizedUid(component: ICAL.Component) {
  const uid = textValue(component, "uid").trim()
  if (!uid) return undefined
  if (uid.length > ICALENDAR_UID_LIMIT) {
    throw new Error(
      `“${uid.slice(0, 60)}…” has a calendar UID longer than ${ICALENDAR_UID_LIMIT} characters.`
    )
  }
  return uid
}

function recurrenceIdentity(component: ICAL.Component) {
  const property = component.getFirstProperty("recurrence-id")
  return property ? property.toICALString() : ""
}

function textValue(component: ICAL.Component, name: string) {
  const value = component.getFirstPropertyValue(name)
  return typeof value === "string" ? value : ""
}

function parseCalendarDate(
  property: ICAL.Property,
  calendar: ICAL.Component,
  targetTimeZone: string
): ParsedCalendarDate {
  const rawValue = property.toJSON()[3]
  if (typeof rawValue !== "string") {
    throw new Error(`Unsupported date value in ${property.name.toUpperCase()}.`)
  }
  assertValidNormalizedCalendarDate(rawValue)
  const value = property.getFirstValue()
  if (!(value instanceof ICAL.Time)) {
    throw new Error(`Unsupported date value “${rawValue}”.`)
  }
  const sourceTimeZone = property.getFirstParameter("tzid") || undefined
  return parseCalendarTime(value, sourceTimeZone, calendar, targetTimeZone)
}

function parseCalendarTime(
  value: ICAL.Time,
  sourceTimeZone: string | undefined,
  calendar: ICAL.Component,
  targetTimeZone: string
): ParsedCalendarDate {
  const normalized = `${fourDigits(value.year)}-${twoDigits(
    value.month
  )}-${twoDigits(value.day)}T${twoDigits(value.hour)}:${twoDigits(
    value.minute
  )}:${twoDigits(value.second)}`
  if (value.isDate) {
    const local = normalized.slice(0, 10) + "T00:00"
    return {
      local,
      instant: zonedDateTimeToDate(`${local}:00`, targetTimeZone),
      allDay: true,
      sourceTimeZone,
    }
  }

  const embeddedTimeZone =
    sourceTimeZone && calendar.getTimeZoneByID(sourceTimeZone)
  const instant =
    value.zone.tzid === "UTC" || embeddedTimeZone
      ? new Date(value.toUnixTime() * 1000)
      : zonedDateTimeToDate(normalized, sourceTimeZone || targetTimeZone)
  return {
    local: formatInTimeZone(instant, targetTimeZone),
    instant,
    allDay: false,
    sourceTimeZone,
  }
}

function assertValidNormalizedCalendarDate(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})Z?)?$/
  )
  if (!match) throw new Error(`Unsupported date value “${value}”.`)
  const [, year, month, day, hour = "00", minute = "00", second = "00"] = match
  assertValidDateParts({
    value: compactCalendarDate(value),
    year,
    month,
    day,
    hour,
    minute,
    second,
  })
}

function compactCalendarDate(value: string) {
  return value.replaceAll("-", "").replaceAll(":", "")
}

function assertValidDateParts({
  value,
  year,
  month,
  day,
  hour,
  minute,
  second,
}: {
  value: string
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
}) {
  const instant = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    )
  )
  if (
    instant.getUTCFullYear() !== Number(year) ||
    instant.getUTCMonth() + 1 !== Number(month) ||
    instant.getUTCDate() !== Number(day) ||
    instant.getUTCHours() !== Number(hour) ||
    instant.getUTCMinutes() !== Number(minute) ||
    instant.getUTCSeconds() !== Number(second)
  ) {
    throw new Error(`Invalid calendar date “${value}”.`)
  }
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0")
}

function fourDigits(value: number) {
  return String(value).padStart(4, "0")
}

function matchCategory(value: string): {
  value: EventCategory
  matched: boolean
} {
  const candidates = value.split(",").map((item) => item.trim().toLowerCase())
  const category = eventCategories.find((item) =>
    candidates.includes(item.toLowerCase())
  )
  return {
    value: category ?? "Reservation",
    matched: Boolean(category),
  }
}

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
}

function safeUid(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function stableEventHash(value: string) {
  return bytesToHex(sha256(new TextEncoder().encode(value)))
}

function foldLine(line: string) {
  const encoder = new TextEncoder()
  const folded: string[] = []
  let segment = ""

  for (const character of line) {
    if (encoder.encode(segment + character).length > 75) {
      folded.push(segment)
      segment = ` ${character}`
    } else {
      segment += character
    }
  }
  folded.push(segment)
  return folded.join("\r\n")
}

function formatDateValue(value: string) {
  const date = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Unsupported all-day date “${value}”.`)
  }
  return date.replaceAll("-", "")
}

function formatUtcDate(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid event date.")
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function eventInstant(
  value: string,
  utcValue: string | undefined,
  timeZone: string
) {
  if (utcValue) {
    const instant = new Date(utcValue)
    if (!Number.isNaN(instant.getTime())) return instant
  }
  return zonedDateTimeToDate(value, timeZone)
}

function zonedDateTimeToDate(value: string, timeZone: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  )
  if (!match) throw new Error(`Unsupported local date “${value}”.`)
  const [, year, month, day, hour, minute, second = "00"] = match
  assertValidDateParts({
    value,
    year,
    month,
    day,
    hour,
    minute,
    second,
  })
  const wallTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )
  let instant = wallTime

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = dateTimeParts(new Date(instant), timeZone)
    const representedWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    )
    instant -= representedWallTime - wallTime
  }

  const result = new Date(instant)
  if (
    formatInTimeZoneWithSeconds(result, timeZone) !== valueWithSeconds(value)
  ) {
    throw new Error(
      `Local date “${value}” does not exist in time zone “${timeZone}”.`
    )
  }
  return result
}

function formatInTimeZone(date: Date, timeZone: string) {
  return formatInTimeZoneWithSeconds(date, timeZone).slice(0, 16)
}

function formatInTimeZoneWithSeconds(date: Date, timeZone: string) {
  const parts = dateTimeParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

function valueWithSeconds(value: string) {
  return value.length === 16 ? `${value}:00` : value
}

function dateTimeParts(date: Date, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>
}
