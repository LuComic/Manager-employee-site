import { describe, expect, test } from "bun:test"

import {
  canAccessManagerPath,
  canAccessTradeManager,
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
    expect(firstWorkerManagerPath({ trades: true })).toBe("/manager/trades")
  })

  test("viewer and editor employees can enter the trade manager only when enabled", () => {
    expect(canAccessTradeManager("viewer", true)).toBe(true)
    expect(canAccessTradeManager("editor", true)).toBe(true)
    expect(canAccessTradeManager("editor", false)).toBe(false)
    expect(canAccessTradeManager("manager", false)).toBe(true)
    expect(canAccessTradeManager("owner", false)).toBe(true)
  })

  test("allows editors to list, create, and edit trades when trades are enabled", () => {
    for (const pathname of [
      "/manager/trades",
      "/manager/trades/new",
      "/manager/trades/trade-a/edit",
    ]) {
      expect(
        canAccessManagerPath({
          access: "editor",
          pathname,
          workersCanEdit: { trades: true },
        })
      ).toBe(true)
      expect(
        canAccessManagerPath({
          access: "editor",
          pathname,
          workersCanEdit: { trades: false },
        })
      ).toBe(false)
    }
  })

  test("keeps schedules and logs manager-only", () => {
    for (const pathname of ["/manager/schedules", "/manager/logs"]) {
      expect(
        canAccessManagerPath({
          access: "editor",
          pathname,
          workersCanEdit: { trades: true },
        })
      ).toBe(false)
      expect(
        canAccessManagerPath({
          access: "manager",
          pathname,
        })
      ).toBe(true)
    }
  })

  test("returns no manager path when editing is disabled", () => {
    expect(firstWorkerManagerPath()).toBeNull()
  })
})
