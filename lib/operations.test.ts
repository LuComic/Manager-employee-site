import { describe, expect, test } from "bun:test"

import {
  formatDate,
  formatTime,
  getAnnouncementState,
  normalizeReadingTime,
  toDateKey,
} from "@/lib/operations"

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
