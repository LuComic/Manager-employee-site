import { describe, expect, test } from "bun:test"

import { normalizeDeputyEndpoint } from "@/lib/deputy"

describe("Deputy installation endpoints", () => {
  test("accepts Deputy installation hosts and normalizes full URLs", () => {
    expect(normalizeDeputyEndpoint("example.eu.deputy.com")).toBe(
      "example.eu.deputy.com"
    )
    expect(normalizeDeputyEndpoint("https://Example.US.Deputy.com/")).toBe(
      "example.us.deputy.com"
    )
  })

  test("rejects non-Deputy hosts and URL smuggling", () => {
    expect(normalizeDeputyEndpoint("deputy.com")).toBeNull()
    expect(normalizeDeputyEndpoint("deputy.com.example.test")).toBeNull()
    expect(normalizeDeputyEndpoint("example.eu.deputy.com.example.test")).toBeNull()
    expect(normalizeDeputyEndpoint("example.eu.deputy.com@evil.test")).toBeNull()
    expect(normalizeDeputyEndpoint("example.eu.deputy.com/api/v1/me")).toBeNull()
    expect(normalizeDeputyEndpoint("example.eu.deputy.com:8443")).toBeNull()
  })
})
