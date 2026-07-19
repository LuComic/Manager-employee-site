import { describe, expect, test } from "bun:test"

import {
  defaultTodaySections,
  normalizeTodaySections,
} from "@/lib/today-sections"

describe("normalizeTodaySections", () => {
  test("uses the complete default order for an existing hub without settings", () => {
    expect(normalizeTodaySections()).toEqual(defaultTodaySections)
  })

  test("keeps saved order and visibility while restoring missing sections", () => {
    expect(
      normalizeTodaySections([
        { key: "useful-guides", visible: false },
        { key: "welcome", visible: true },
      ])
    ).toEqual([
      { key: "useful-guides", visible: false },
      { key: "welcome", visible: true },
      { key: "quick-links", visible: true },
      { key: "happening-today", visible: true },
      { key: "current-announcements", visible: true },
      { key: "coming-next", visible: true },
    ])
  })

  test("ignores unknown and duplicate sections", () => {
    expect(
      normalizeTodaySections([
        { key: "quick-links", visible: false },
        { key: "quick-links", visible: true },
        { key: "old-section", visible: true },
      ])[0]
    ).toEqual({ key: "quick-links", visible: false })
  })
})
