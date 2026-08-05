import { describe, expect, test } from "bun:test"

import {
  addHoursToLocalDateTime,
  eventOccursOnDate,
  formatDate,
  formatEventDate,
  formatEventTime,
  formatTime,
  getAnnouncementState,
  normalizeReadingTime,
  toDateKey,
  type CalendarEvent,
} from "@/lib/operations"
import { eventCategoryLabel } from "@/lib/categories"

describe("event category labels", () => {
  test("uses the manager-defined label", () => {
    expect(
      eventCategoryLabel("custom-event", [
        {
          id: "custom-event",
          label: "Inventuur",
          kind: "event",
        },
      ])
    ).toBe("Inventuur")
  })
})

const calendarEvent: CalendarEvent = {
  id: "event",
  title: "Event",
  description: "Description",
  category: "event-training",
  start: "2026-07-24T00:00",
  end: "2026-07-27T00:00",
  allDay: true,
  location: "Office",
  employees: [],
  notes: "",
  attachments: [],
  guideIds: [],
  published: true,
}

describe("normalizeReadingTime", () => {
  test("adds minutes to a number-only reading time", () => {
    expect(normalizeReadingTime("6")).toBe("6 min")
  })

  test("preserves an existing unit", () => {
    expect(normalizeReadingTime("6 min")).toBe("6 min")
  })

  test("trims surrounding whitespace", () => {
    expect(normalizeReadingTime("  6  ")).toBe("6 min")
  })
})

describe("Europe/Tallinn dates", () => {
  test("adds an hour to local event times and carries into the next day", () => {
    expect(addHoursToLocalDateTime("2026-08-01T14:00", 1)).toBe(
      "2026-08-01T15:00"
    )
    expect(addHoursToLocalDateTime("2026-08-01T23:30", 1)).toBe(
      "2026-08-02T00:30"
    )
    expect(addHoursToLocalDateTime("2026-02-30T14:00", 1)).toBe("")
  })

  test("keeps local calendar event wall time stable", () => {
    expect(toDateKey("2026-07-18T09:30")).toBe("2026-07-18")
    expect(formatTime("2026-07-18T09:30")).toBe("09:30")
    expect(
      formatDate("2026-07-18T09:30", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    ).toBe("18/07/2026")
  })

  test("evaluates announcement dates by Tallinn calendar date", () => {
    const announcement = {
      id: "notice",
      title: "Notice",
      content: { type: "doc" as const, content: [] },
      publishedAt: "2026-07-18",
      expiresAt: "2026-07-18",
      priority: "Normal" as const,
      pinned: false,
      published: true,
    }
    expect(
      getAnnouncementState(announcement, new Date("2026-07-18T12:00:00+03:00"))
    ).toBe("Active")
    expect(
      getAnnouncementState(announcement, new Date("2026-07-19T00:01:00+03:00"))
    ).toBe("Expired")
  })
})

describe("calendar event presentation", () => {
  test("shows all dates covered by a multi-day all-day event", () => {
    expect(eventOccursOnDate(calendarEvent, "2026-07-23")).toBeFalse()
    expect(eventOccursOnDate(calendarEvent, "2026-07-24")).toBeTrue()
    expect(eventOccursOnDate(calendarEvent, "2026-07-25")).toBeTrue()
    expect(eventOccursOnDate(calendarEvent, "2026-07-26")).toBeTrue()
    expect(eventOccursOnDate(calendarEvent, "2026-07-27")).toBeFalse()
    expect(
      formatEventDate(calendarEvent, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    ).toBe("24/07/2026–26/07/2026")
  })

  test("disambiguates repeated wall-clock times during DST fallback", () => {
    expect(
      formatEventTime(
        {
          ...calendarEvent,
          start: "2026-10-25T03:30",
          end: "2026-10-25T03:15",
          startUtc: "2026-10-25T00:30:00.000Z",
          endUtc: "2026-10-25T01:15:00.000Z",
          allDay: false,
        },
        "Europe/Tallinn"
      )
    ).toBe("03:30 EEST–03:15 EET")
  })
})
