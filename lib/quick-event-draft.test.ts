import { describe, expect, test } from "bun:test"

import {
  createQuickEventDraft,
  quickEventDraftToCalendarEvent,
} from "@/lib/quick-event-draft"

describe("quick event drafts", () => {
  test("starts as a single-day draft", () => {
    expect(createQuickEventDraft("2026-08-15")).toEqual({
      title: "",
      description: "",
      start: "2026-08-15T10:00",
      end: "2026-08-15T11:00",
    })
  })

  test("converts the selected local date and times into a calendar event", () => {
    expect(
      quickEventDraftToCalendarEvent(
        {
          title: "Summer menu",
          description: "Launch the updated menu.",
          start: "2026-08-15T10:30",
          end: "2026-08-15T12:00",
        },
        {
          id: "summer-menu",
          category: "event-training",
          location: "Merevaade",
        }
      )
    ).toMatchObject({
      id: "summer-menu",
      title: "Summer menu",
      description: "Launch the updated menu.",
      start: "2026-08-15T10:30",
      end: "2026-08-15T12:00",
      allDay: false,
      category: "event-training",
      location: "Merevaade",
      published: true,
    })
  })
})
