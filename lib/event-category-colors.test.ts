import { describe, expect, test } from "bun:test"

import {
  eventCategoryColor,
  eventCategoryColorStyles,
} from "@/lib/event-category-colors"

describe("event category colors", () => {
  test("uses a saved category color consistently", () => {
    const eventTypes = [
      { id: "training", color: "violet" as const },
      { id: "maintenance", color: "amber" as const },
    ]

    expect(eventCategoryColor("training", eventTypes)).toBe("violet")
    expect(eventCategoryColorStyles.violet.dot).toContain("violet")
    expect(eventCategoryColorStyles.violet.rail).toContain("violet")
  })

  test("gives legacy categories a deterministic fallback", () => {
    const eventTypes = [{ id: "training" }, { id: "maintenance" }]

    expect(eventCategoryColor("training", eventTypes)).toBe("blue")
    expect(eventCategoryColor("maintenance", eventTypes)).toBe("teal")
    expect(eventCategoryColor("deputy-schedules", eventTypes)).toBe("slate")
  })
})
