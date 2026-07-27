import { describe, expect, test } from "bun:test"

import { clerkCorrelationCredential } from "@/lib/clerk-metadata"

describe("Clerk invitation metadata", () => {
  test("reads the current workhal claim", () => {
    expect(clerkCorrelationCredential({ workhalClaim: "current" })).toBe(
      "current"
    )
  })

  test("keeps pending invitations created with the legacy claim working", () => {
    expect(clerkCorrelationCredential({ operationsHubClaim: "legacy" })).toBe(
      "legacy"
    )
  })

  test("prefers the current claim and ignores invalid metadata", () => {
    expect(
      clerkCorrelationCredential({
        workhalClaim: "current",
        operationsHubClaim: "legacy",
      })
    ).toBe("current")
    expect(clerkCorrelationCredential({ workhalClaim: 42 })).toBeUndefined()
    expect(clerkCorrelationCredential(null)).toBeUndefined()
  })
})
