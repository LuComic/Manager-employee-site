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
      startDate: "2026-08-15",
      endDate: "2026-08-15",
    })
  })

  test("converts inclusive dates into an all-day calendar event", () => {
    expect(
      quickEventDraftToCalendarEvent(
        {
          title: "Summer menu",
          description: "Launch the updated menu.",
          startDate: "2026-08-15",
          endDate: "2026-08-17",
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
      start: "2026-08-15T00:00",
      end: "2026-08-18T00:00",
      allDay: true,
      category: "event-training",
      location: "Merevaade",
      published: true,
    })
  })
})
