import { describe, expect, test } from "bun:test"

import {
  calendarFileName,
  ICALENDAR_UID_DOMAIN,
  mergeImportedEvent,
  parseICalendar,
  serializeICalendar,
} from "@/lib/icalendar"
import type { CalendarEvent } from "@/lib/operations"

const event: CalendarEvent = {
  id: "team-training",
  title: "Team training, session",
  description: "Service workflow & safety",
  category: "Training",
  start: "2026-07-24T10:00",
  end: "2026-07-24T11:30",
  allDay: false,
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
      uidNamespace: "hub-a",
      now: new Date("2026-07-24T06:00:00Z"),
    })

    expect(calendar).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0")
    expect(ICALENDAR_UID_DOMAIN).toBe("workhal.local")
    expect(calendar.replaceAll("\r\n ", "")).toContain(
      `@${ICALENDAR_UID_DOMAIN}`
    )
    expect(calendar).toContain("DTSTART:20260724T070000Z")
    expect(calendar).toContain("DTEND:20260724T083000Z")
    expect(calendar).toContain("SUMMARY:Team training\\, session")
    expect(calendar).toContain("LOCATION:Whole venue\\; terrace")
    expect(calendar).toContain("X-WORKHAL-UID-NAMESPACE:hub-a")
    expect(calendar).toContain(
      "DESCRIPTION:Service workflow & safety\\n\\nNotes:\\nBring printed menus."
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
      uidNamespace: "hub-a",
      now: new Date("2026-07-24T06:00:00Z"),
    })
    const result = parseICalendar(calendar, {
      timeZone: "Europe/Tallinn",
      uidNamespace: "hub-a",
    })

    expect(result.events[0]).toMatchObject({
      id: event.id,
      title: event.title,
      description: event.description,
      notes: event.notes,
      start: event.start,
      end: event.end,
      allDay: false,
      location: event.location,
      category: event.category,
    })
  })

  test("keeps long descriptions and notes in separate fields", () => {
    const detailedEvent: CalendarEvent = {
      ...event,
      description: "D".repeat(500),
      notes: "N".repeat(4000),
    }
    const result = parseICalendar(
      serializeICalendar([detailedEvent], {
        calendarName: "Venue calendar",
        timeZone: "Europe/Tallinn",
        uidNamespace: "hub-a",
      }),
      { timeZone: "Europe/Tallinn", uidNamespace: "hub-a" }
    )

    expect(result.issues).toEqual([])
    expect(result.events[0]?.description).toBe(detailedEvent.description)
    expect(result.events[0]?.notes).toBe(detailedEvent.notes)
  })

  test("keeps all-day events all day across export and import", () => {
    const allDayEvent: CalendarEvent = {
      ...event,
      start: "2026-07-24T00:00",
      end: "2026-07-25T00:00",
      allDay: true,
    }
    const calendar = serializeICalendar([allDayEvent], {
      calendarName: "Venue calendar",
      timeZone: "Europe/Tallinn",
      uidNamespace: "hub-a",
      now: new Date("2026-07-24T06:00:00Z"),
    })

    expect(calendar).toContain("DTSTART;VALUE=DATE:20260724")
    expect(calendar).toContain("DTEND;VALUE=DATE:20260725")
    expect(calendar).not.toContain("DTSTART:202607")

    const result = parseICalendar(calendar, {
      timeZone: "Europe/Tallinn",
      uidNamespace: "hub-a",
    })
    expect(result.events[0]).toMatchObject({
      start: "2026-07-24T00:00",
      end: "2026-07-25T00:00",
      allDay: true,
    })
    expect(result.events[0]?.startUtc).toBeUndefined()
    expect(result.events[0]?.endUtc).toBeUndefined()
  })

  test("namespaces generated UIDs by workplace", () => {
    const exportUid = (uidNamespace: string) =>
      serializeICalendar([event], {
        calendarName: "Venue calendar",
        timeZone: "Europe/Tallinn",
        uidNamespace,
        now: new Date("2026-07-24T06:00:00Z"),
      })
        .match(/^UID:(.+)$/m)?.[1]
        ?.trim()

    expect(exportUid("hub-a")).toBe(exportUid("hub-a"))
    expect(exportUid("hub-a")).not.toBe(exportUid("hub-b"))
  })

  test("namespaces the export UID of externally imported events", () => {
    const importedEvent = {
      ...event,
      icalUid: "source-event@example.com",
    }
    const exportedUid = (uidNamespace: string) =>
      serializeICalendar([importedEvent], {
        calendarName: "Venue calendar",
        timeZone: "Europe/Tallinn",
        uidNamespace,
      })
        .match(/^UID:(.+)$/m)?.[1]
        ?.trim()

    expect(exportedUid("hub-a")).not.toBe("source-event@example.com")
    expect(exportedUid("hub-a")).not.toBe(exportedUid("hub-b"))
  })

  test("requires a non-empty UID namespace for exports", () => {
    expect(() =>
      serializeICalendar([event], {
        calendarName: "Venue calendar",
        timeZone: "Europe/Tallinn",
        uidNamespace: "",
      })
    ).toThrow("A valid workhal UID namespace is required.")
  })
})

describe("iCalendar import", () => {
  test("matches manager-defined event types", () => {
    const result = parseICalendar(
      calendar([
        "UID:custom-category",
        "DTSTART:20260801T100000Z",
        "DTEND:20260801T110000Z",
        "SUMMARY:Inventory",
        "DESCRIPTION:Count stock",
        "LOCATION:Stockroom",
        "CATEGORIES:Inventuur",
      ]),
      {
        timeZone: "Europe/Tallinn",
        uidNamespace: "hub-a",
        eventTypes: [
          {
            id: "event-inventory",
            label: "Inventuur",
            description: "",
            iconKey: "general",
            kind: "event",
          },
        ],
      }
    )

    expect(result.events[0]?.category).toBe("event-inventory")
  })

  test("imports UTC, zoned, and folded event values", () => {
    const result = parseICalendar(
      calendar([
        "UID:team-training@example.com",
        "DTSTART:20260724T070000Z",
        "DTEND;TZID=America/New_York:20260724T060000",
        "SUMMARY:Team training",
        "DESCRIPTION:First line\\nSecond",
        "  line",
        "LOCATION:Main room",
        "CATEGORIES:Training",
      ]),
      { timeZone: "Europe/Tallinn", uidNamespace: "hub-a" }
    )

    expect(result.issues).toEqual([])
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      title: "Team training",
      description: "First line\nSecond line",
      category: "Training",
      start: "2026-07-24T10:00",
      end: "2026-07-24T13:00",
      startUtc: "2026-07-24T07:00:00.000Z",
      endUtc: "2026-07-24T10:00:00.000Z",
      allDay: false,
      location: "Main room",
      published: false,
    })
    expect(result.events[0]?.id).toMatch(/^external-[a-f0-9]{64}$/)
  })

  test("rejects a workhal event identity without its UID namespace", () => {
    const result = parseICalendar(
      calendar([
        "UID:arbitrary@example.com",
        "X-WORKHAL-ID:team-training",
        "DTSTART:20260724T070000Z",
        "DTEND:20260724T080000Z",
        "SUMMARY:Unsafe event",
      ]),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(result.events).toEqual([])
    expect(result.issues).toEqual([
      {
        severity: "error",
        key: "calendarEventMissingUidNamespace",
        values: { index: 1 },
      },
    ])
  })

  test("rejects a workhal event identity that does not match its namespace", () => {
    const result = parseICalendar(
      calendar([
        "UID:arbitrary@example.com",
        "X-WORKHAL-ID:team-training",
        "X-WORKHAL-UID-NAMESPACE:hub-a",
        "DTSTART:20260724T070000Z",
        "DTEND:20260724T080000Z",
        "SUMMARY:Unsafe event",
      ]),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(result.events).toEqual([])
    expect(result.issues).toEqual([
      {
        severity: "error",
        key: "calendarEventInvalidWorkhalIdentity",
        values: { index: 1 },
      },
    ])
  })

  test("rejects a valid workhal event from another workplace", () => {
    const source = serializeICalendar([event], {
      calendarName: "Venue calendar",
      timeZone: "UTC",
      uidNamespace: "hub-a",
    })
    const result = parseICalendar(source, {
      timeZone: "UTC",
      uidNamespace: "hub-b",
    })

    expect(result.events).toEqual([])
    expect(result.issues).toEqual([
      {
        severity: "error",
        key: "calendarEventInvalidWorkhalIdentity",
        values: { index: 1 },
      },
    ])
  })

  test("rejects a cancellation from another workplace", () => {
    const source = serializeICalendar([event], {
      calendarName: "Venue calendar",
      timeZone: "UTC",
      uidNamespace: "hub-a",
    }).replace("STATUS:CONFIRMED", "STATUS:CANCELLED")
    const result = parseICalendar(source, {
      timeZone: "UTC",
      uidNamespace: "hub-b",
    })

    expect(result.cancellations).toEqual([])
    expect(result.issues).toEqual([
      {
        severity: "error",
        key: "calendarEventInvalidWorkhalIdentity",
        values: { index: 1 },
      },
    ])
  })

  test("uses embedded Outlook VTIMEZONE definitions", () => {
    const result = parseICalendar(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VTIMEZONE",
        "TZID:FLE Standard Time",
        "BEGIN:STANDARD",
        "DTSTART:19701025T040000",
        "TZOFFSETFROM:+0300",
        "TZOFFSETTO:+0200",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "BEGIN:DAYLIGHT",
        "DTSTART:19700329T030000",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0300",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:outlook-event",
        "DTSTART;TZID=FLE Standard Time:20260724T100000",
        "DTEND;TZID=FLE Standard Time:20260724T110000",
        "SUMMARY:Outlook event",
        "DESCRIPTION:Imported from Outlook",
        "LOCATION:Office",
        "CATEGORIES:Training",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
      { timeZone: "Europe/Tallinn", uidNamespace: "hub-a" }
    )

    expect(result.issues).toEqual([])
    expect(result.events[0]).toMatchObject({
      start: "2026-07-24T10:00",
      end: "2026-07-24T11:00",
      startUtc: "2026-07-24T07:00:00.000Z",
      endUtc: "2026-07-24T08:00:00.000Z",
    })
  })

  test("returns cancellations separately from importable events", () => {
    const active = parseICalendar(
      calendar(eventLines("cancelled-uid", "Scheduled event").slice(1, -1)),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )
    const cancelled = parseICalendar(
      calendar([
        "UID:cancelled-uid",
        "STATUS:CANCELLED",
        "SUMMARY:Scheduled event",
      ]),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(cancelled.events).toEqual([])
    expect(cancelled.cancellations).toEqual([
      {
        id: active.events[0]?.id,
        title: "Scheduled event",
      },
    ])
  })

  test("imports all-day events and defaults their exclusive end", () => {
    const result = parseICalendar(
      calendar([
        "DTSTART;VALUE=DATE:20260724",
        "SUMMARY:Closed",
        "DESCRIPTION:Closed for maintenance",
        "LOCATION:Whole venue",
      ]),
      {
        timeZone: "Europe/Tallinn",
        uidNamespace: "hub-a",
        published: true,
      }
    )

    expect(result.events[0]).toMatchObject({
      start: "2026-07-24T00:00",
      end: "2026-07-25T00:00",
      allDay: true,
      published: true,
    })
    expect(result.issues).toContainEqual({
      severity: "warning",
      key: "calendarEventNoEndDate",
      values: expect.objectContaining({ index: 1, title: "Closed" }),
    })
  })

  test("keeps valid events while reporting invalid ones", () => {
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
      { timeZone: "Europe/Tallinn", uidNamespace: "hub-a" }
    )

    expect(result.events).toHaveLength(1)
    expect(result.issues).toContainEqual({
      severity: "error",
      key: "calendarEventCouldNotBeImported",
      values: { index: 1 },
    })
    expect(
      result.issues.some((issue) => issue.severity === "warning")
    ).toBeTrue()
  })

  test("rejects impossible calendar dates instead of normalizing them", () => {
    const result = parseICalendar(
      calendar([
        "UID:bad-date",
        "DTSTART:20260231T090000Z",
        "DTEND:20260231T100000Z",
        "SUMMARY:Impossible",
      ]),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(result.events).toEqual([])
    expect(result.issues).toEqual([
      {
        severity: "error",
        key: "calendarEventCouldNotBeImported",
        values: { index: 1 },
      },
    ])
  })

  test("accepts valid events that cross a daylight-saving fallback", () => {
    const result = parseICalendar(
      calendar([
        "UID:fall-back",
        "DTSTART:20261025T003000Z",
        "DTEND:20261025T011500Z",
        "SUMMARY:Fallback",
        "DESCRIPTION:Clock change",
        "LOCATION:Main room",
        "CATEGORIES:Training",
      ]),
      { timeZone: "Europe/Tallinn", uidNamespace: "hub-a" }
    )

    expect(result.issues).toEqual([])
    expect(result.events[0]).toMatchObject({
      start: "2026-10-25T03:30",
      end: "2026-10-25T03:15",
      startUtc: "2026-10-25T00:30:00.000Z",
      endUtc: "2026-10-25T01:15:00.000Z",
    })
  })

  test("creates bounded deterministic unique IDs from arbitrary UIDs", () => {
    const first = parseICalendar(
      calendar([
        `UID:${"a".repeat(180)}+first@example.com`,
        "DTSTART:20260724T090000Z",
        "DTEND:20260724T100000Z",
        "SUMMARY:First",
      ]),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )
    const second = parseICalendar(
      calendar([
        `UID:${"a".repeat(180)}@first@example.com`,
        "DTSTART:20260724T090000Z",
        "DTEND:20260724T100000Z",
        "SUMMARY:Second",
      ]),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(first.events[0]?.id.length).toBeLessThanOrEqual(100)
    expect(second.events[0]?.id.length).toBeLessThanOrEqual(100)
    expect(first.events[0]?.id).not.toBe(second.events[0]?.id)
    expect(
      parseICalendar(
        calendar([
          `UID:${"a".repeat(180)}+first@example.com`,
          "DTSTART:20260724T090000Z",
          "DTEND:20260724T100000Z",
          "SUMMARY:First",
        ]),
        { timeZone: "UTC", uidNamespace: "hub-a" }
      ).events[0]?.id
    ).toBe(first.events[0]?.id)
  })

  test("does not emit duplicate IDs from the same file", () => {
    const result = parseICalendar(
      [
        "BEGIN:VCALENDAR",
        ...eventLines("same-uid", "First"),
        ...eventLines("same-uid", "Second"),
        "END:VCALENDAR",
      ].join("\r\n"),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(result.events).toHaveLength(1)
    expect(result.issues).toContainEqual({
      severity: "error",
      key: "calendarEventCouldNotBeImported",
      values: { index: 2 },
    })
  })

  test("reports field limits before saving", () => {
    const result = parseICalendar(
      calendar([
        "UID:long-description",
        "DTSTART:20260724T090000Z",
        "DTEND:20260724T100000Z",
        "SUMMARY:Too much detail",
        `DESCRIPTION:${"x".repeat(501)}`,
      ]),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(result.events).toEqual([])
    expect(result.issues[0]).toEqual({
      severity: "error",
      key: "calendarEventCouldNotBeImported",
      values: { index: 1 },
    })
  })

  test("limits free-tier imports to a bounded number of calendar changes", () => {
    const result = parseICalendar(
      [
        "BEGIN:VCALENDAR",
        ...Array.from({ length: 30 }, (_, index) =>
          eventLines(`event-${index}`, `Event ${index}`)
        ).flat(),
        "END:VCALENDAR",
      ].join("\r\n"),
      { timeZone: "UTC", uidNamespace: "hub-a" }
    )

    expect(result.events).toHaveLength(25)
    expect(result.issues).toContainEqual({
      severity: "warning",
      key: "calendarOnlyFirstEventsRead",
      values: { count: 25 },
    })
  })
})

describe("safe re-imports", () => {
  test("updates calendar details and preserves every manager-owned field", () => {
    const imported: CalendarEvent = {
      ...event,
      id: "external-stable",
      title: "Externally updated",
      description: "New external description",
      category: "Reservation",
      start: "2026-07-25T00:00",
      end: "2026-07-26T00:00",
      allDay: true,
      employees: [],
      notes: "",
      attachments: [],
      guideIds: [],
      published: false,
    }
    const existing: CalendarEvent = {
      ...event,
      id: imported.id,
      category: "Inspection",
      employees: [{ id: "employee-1", displayName: "Manager choice" }],
      notes: "Manager note",
      attachments: [
        {
          id: "attachment-1",
          name: "plan.pdf",
          contentType: "application/pdf",
          size: 100,
          url: "https://example.com/plan.pdf",
        },
      ],
      guideIds: ["manager-guide"],
      published: true,
    }

    expect(mergeImportedEvent(imported, existing, false)).toEqual({
      ...imported,
      category: existing.category,
      employees: existing.employees,
      notes: existing.notes,
      attachments: existing.attachments,
      guideIds: existing.guideIds,
      published: existing.published,
    })
  })
})

function calendar(lines: string[]) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    ...lines,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

function eventLines(uid: string, title: string) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTART:20260724T090000Z",
    "DTEND:20260724T100000Z",
    `SUMMARY:${title}`,
    "END:VEVENT",
  ]
}
