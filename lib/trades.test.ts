import { describe, expect, test } from "vitest"

import { tradeStatusIconClass } from "@/lib/trades"

describe("trade display helpers", () => {
  test("uses teal and warning tokens only on active trade icons", () => {
    expect(tradeStatusIconClass("published")).toContain("text-primary")
    expect(tradeStatusIconClass("offer-pending")).toContain("text-warning")
    expect(tradeStatusIconClass("confirmed")).toContain("text-warning")
    expect(tradeStatusIconClass("processing")).toContain("text-warning")
    expect(tradeStatusIconClass("approved")).toContain("text-muted-foreground")
  })
})
