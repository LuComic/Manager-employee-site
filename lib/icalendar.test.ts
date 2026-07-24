import { describe, expect, test } from "bun:test"

import {
  calendarFileName,
  parseICalendar,
  serializeICalendar,
} from "@/lib/icalendar"
import type { CalendarEvent } from "@/lib/operations"

const event: CalendarEvent = {
  id: "summer-menu",
  title: "Summer menu, launch",
  description: "Seasonal food & drinks",
  category: "Promotion",
  start: "2026-07-24T10:00",
  end: "2026-07-24T11:30",
  location: "Whole venue; terrace",
  employees: [],
  notes: "Bring printed menus.",
  attachments: [],
  guideIds: [],
  published: true,
}

describe("iCalendar export", () => {
  test("exports portable UTC events with escaped text", () => {
    const calendar = serializeICalendar([event], {
      calendarName: "Venue calendar",
      timeZone: "Europe/Tallinn",
      now: new Date("2026-07-24T06:00:00Z"),
    })

    expect(calendar).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0")
    expect(calendar).toContain("DTSTART:20260724T070000Z")
    expect(calendar).toContain("DTEND:20260724T083000Z")
    expect(calendar).toContain("SUMMARY:Summer menu\\, launch")
    expect(calendar).toContain("LOCATION:Whole venue\\; terrace")
    expect(calendar).toContain(
      "DESCRIPTION:Seasonal food & drinks\\n\\nNotes:\\nBring printed menus."
    )
    expect(calendar).toEndWith("END:VCALENDAR\r\n")
  })

  test("creates safe .ics filenames", () => {
    expect(calendarFileName("Mäe Café Calendar")).toBe("mae-cafe-calendar.ics")
  })

  test("round-trips exported times in the workplace time zone", () => {
    const calendar = serializeICalendar([event], {
      calendarName: "Venue calendar",
      timeZone: "Europe/Tallinn",
      now: new Date("2026-07-24T06:00:00Z"),
    })
    const result = parseICalendar(calendar, {
      timeZone: "Europe/Tallinn",
    })

    expect(result.events[0]).toMatchObject({
      title: event.title,
      start: event.start,
      end: event.end,
      location: event.location,
      category: event.category,
    })
  })
})

describe("iCalendar import", () => {
  test("imports UTC, zoned, and folded event values", () => {
    const result = parseICalendar(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:team-training@example.com",
        "DTSTART:20260724T070000Z",
        "DTEND;TZID=America/New_York:20260724T060000",
        "SUMMARY:Team training",
        "DESCRIPTION:First line\\nSecond",
        "  line",
        "LOCATION:Main room",
        "CATEGORIES:Training",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
      { timeZone: "Europe/Tallinn" }
    )

    expect(result.errors).toEqual([])
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      id: "external-team-training-example-com",
      title: "Team training",
      description: "First line\nSecond line",
      category: "Training",
      start: "2026-07-24T10:00",
      end: "2026-07-24T13:00",
      location: "Main room",
      published: false,
    })
  })

  test("imports all-day events and defaults their end to the next day", () => {
    const result = parseICalendar(
      [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "DTSTART;VALUE=DATE:20260724",
        "SUMMARY:Closed",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\n"),
      { timeZone: "Europe/Tallinn", published: true }
    )

    expect(result.events[0]).toMatchObject({
      start: "2026-07-24T00:00",
      end: "2026-07-25T00:00",
      published: true,
    })
  })

  test("reports invalid events without discarding valid ones", () => {
    const result = parseICalendar(
      [
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT",
        "SUMMARY:Missing start",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "DTSTART:20260724T090000",
        "SUMMARY:Valid event",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
      { timeZone: "Europe/Tallinn" }
    )

    expect(result.events).toHaveLength(1)
    expect(result.errors).toEqual([
      "Event 1: “Missing start” is missing a start date.",
    ])
  })
})
