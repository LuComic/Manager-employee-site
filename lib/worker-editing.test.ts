import { describe, expect, test } from "bun:test"

import {
  defaultWorkersCanEdit,
  firstWorkerManagerPath,
  normalizeWorkersCanEdit,
} from "@/lib/worker-editing"

describe("worker editing settings", () => {
  test("defaults every section to disabled", () => {
    expect(normalizeWorkersCanEdit()).toEqual(defaultWorkersCanEdit)
  })

  test("chooses the first enabled manager section", () => {
    expect(
      firstWorkerManagerPath({
        events: true,
        documents: true,
      })
    ).toBe("/manager/calendar")
    expect(firstWorkerManagerPath({ faqs: true })).toBe("/manager/questions")
  })

  test("returns no manager path when editing is disabled", () => {
    expect(firstWorkerManagerPath()).toBeNull()
  })
})
