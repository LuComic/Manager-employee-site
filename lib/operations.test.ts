import { describe, expect, test } from "bun:test"

import { normalizeReadingTime } from "@/lib/operations"

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
