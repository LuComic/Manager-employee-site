import {
  eventCategories,
  slugify,
  type CalendarEvent,
  type EventCategory,
} from "@/lib/operations"

const MAX_IMPORTED_EVENTS = 500

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

export type CalendarImportResult = {
  events: CalendarEvent[]
  errors: string[]
}

type ContentLine = {
  name: string
  params: Record<string, string>
  value: string
}

export function serializeICalendar(
  events: CalendarEvent[],
  {
    calendarName,
    timeZone,
    uidDomain = "operations-hub.local",
    now = new Date(),
  }: CalendarOptions
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Operations Hub//Shared Calendar//EN",
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
  const errors: string[] = []
  const calendarLines = unfoldLines(source)
  const eventGroups: ContentLine[][] = []
  let current: ContentLine[] | null = null

  for (const rawLine of calendarLines) {
    const line = parseContentLine(rawLine)
    if (!line) continue
    if (line.name === "BEGIN" && line.value.toUpperCase() === "VEVENT") {
      current = []
      continue
    }
    if (line.name === "END" && line.value.toUpperCase() === "VEVENT") {
      if (current) eventGroups.push(current)
      current = null
      continue
    }
    if (current) current.push(line)
  }

  if (!eventGroups.length) {
    return {
      events: [],
      errors: ["This file does not contain any calendar events."],
    }
  }

  if (eventGroups.length > MAX_IMPORTED_EVENTS) {
    errors.push(
      `Only the first ${MAX_IMPORTED_EVENTS} events were read from this file.`
    )
  }

  const events = eventGroups
    .slice(0, MAX_IMPORTED_EVENTS)
    .flatMap((lines, index) => {
      try {
        const event = parseEvent(lines, timeZone, published)
        if (getLine(lines, "RRULE")) {
          errors.push(
            `Event ${index + 1}: “${event.title}” is recurring and was imported as a single event.`
          )
        }
        return [event]
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The event is invalid."
        errors.push(`Event ${index + 1}: ${message}`)
        return []
      }
    })

  return { events, errors }
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
  const description = [event.description, event.notes]
    .filter(Boolean)
    .join("\n\nNotes:\n")
  return [
    "BEGIN:VEVENT",
    `UID:${safeUid(event.id)}@${safeUid(uidDomain)}`,
    `DTSTAMP:${formatUtcDate(now)}`,
    `DTSTART:${formatUtcDate(zonedDateTimeToDate(event.start, timeZone))}`,
    `DTEND:${formatUtcDate(zonedDateTimeToDate(event.end, timeZone))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(event.location)}`,
    `CATEGORIES:${escapeText(event.category)}`,
    `STATUS:${event.published ? "CONFIRMED" : "TENTATIVE"}`,
    "END:VEVENT",
  ]
}

function parseEvent(
  lines: ContentLine[],
  targetTimeZone: string,
  published: boolean
): CalendarEvent {
  const summary = getValue(lines, "SUMMARY")?.trim()
  const startLine = getLine(lines, "DTSTART")
  const endLine = getLine(lines, "DTEND")

  if (!summary) throw new Error("Missing an event title.")
  if (!startLine) throw new Error(`“${summary}” is missing a start date.`)

  const start = parseCalendarDate(startLine, targetTimeZone)
  const isAllDay =
    startLine.params.VALUE?.toUpperCase() === "DATE" ||
    /^\d{8}$/.test(startLine.value)
  const end = endLine
    ? parseCalendarDate(endLine, targetTimeZone)
    : addMinutes(start, isAllDay ? 24 * 60 : 60)

  if (end <= start) throw new Error(`“${summary}” ends before it starts.`)

  const uid = getValue(lines, "UID")?.trim()
  const recurrenceId = getValue(lines, "RECURRENCE-ID")?.trim()
  const description = unescapeText(getValue(lines, "DESCRIPTION") ?? "").trim()
  const location = unescapeText(getValue(lines, "LOCATION") ?? "").trim()
  const rawCategories = unescapeText(getValue(lines, "CATEGORIES") ?? "")
  const category = matchCategory(rawCategories)
  const identity = uid
    ? `${uid}${recurrenceId ? `-${recurrenceId}` : ""}`
    : `${summary}-${start}`

  return {
    id: `external-${slugify(identity) || slugify(`${summary}-${start}`)}`,
    title: unescapeText(summary),
    description: description || "Imported from an external calendar.",
    category,
    start,
    end,
    location: location || "No location specified",
    employees: [],
    notes: "",
    attachments: [],
    guideIds: [],
    published,
  }
}

function getLine(lines: ContentLine[], name: string) {
  return lines.find((line) => line.name === name)
}

function getValue(lines: ContentLine[], name: string) {
  return getLine(lines, name)?.value
}

function parseContentLine(rawLine: string): ContentLine | null {
  const separator = rawLine.indexOf(":")
  if (separator < 0) return null
  const [rawName, ...rawParams] = rawLine.slice(0, separator).split(";")
  const params = Object.fromEntries(
    rawParams.map((param) => {
      const equals = param.indexOf("=")
      if (equals < 0) return [param.toUpperCase(), ""]
      return [
        param.slice(0, equals).toUpperCase(),
        param.slice(equals + 1).replace(/^"|"$/g, ""),
      ]
    })
  )
  return {
    name: rawName.toUpperCase(),
    params,
    value: rawLine.slice(separator + 1),
  }
}

function parseCalendarDate(line: ContentLine, targetTimeZone: string) {
  const value = line.value.trim()
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/
  )
  if (!match) throw new Error(`Unsupported date value “${value}”.`)

  const [, year, month, day, hour = "00", minute = "00", second = "00", utc] =
    match
  if (!match[4]) return `${year}-${month}-${day}T00:00`

  const normalized = `${year}-${month}-${day}T${hour}:${minute}:${second}`
  if (utc) {
    return formatInTimeZone(
      new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute),
          Number(second)
        )
      ),
      targetTimeZone
    )
  }

  const sourceTimeZone = line.params.TZID
  if (!sourceTimeZone || sourceTimeZone === targetTimeZone) {
    return normalized.slice(0, 16)
  }
  return formatInTimeZone(
    zonedDateTimeToDate(normalized, sourceTimeZone),
    targetTimeZone
  )
}

function matchCategory(value: string): EventCategory {
  const candidates = value.split(",").map((item) => item.trim().toLowerCase())
  return (
    eventCategories.find((category) =>
      candidates.includes(category.toLowerCase())
    ) ?? "Reservation"
  )
}

function unfoldLines(source: string) {
  return source.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)
}

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
}

function unescapeText(value: string) {
  return value.replace(/\\[nN]/g, "\n").replace(/\\([\\,;])/g, "$1")
}

function safeUid(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
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

function formatUtcDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
}

function zonedDateTimeToDate(value: string, timeZone: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  )
  if (!match) throw new Error(`Unsupported local date “${value}”.`)
  const [, year, month, day, hour, minute, second = "00"] = match
  const wallTime = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )
  let instant = wallTime

  for (let iteration = 0; iteration < 2; iteration += 1) {
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

  return new Date(instant)
}

function formatInTimeZone(date: Date, timeZone: string) {
  const parts = dateTimeParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
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

function addMinutes(value: string, minutes: number) {
  const [date, time] = value.split("T")
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const result = new Date(
    Date.UTC(year, month - 1, day, hour, minute + minutes)
  )
  return result.toISOString().slice(0, 16)
}
