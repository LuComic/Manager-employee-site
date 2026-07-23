import { describe, expect, test } from "bun:test"

import { assertAdminRemovalIsSafe } from "./organization-access"

describe("Organization admin safeguards", () => {
  test("blocks removal of the last admin", () => {
    expect(() => assertAdminRemovalIsSafe("org:admin", 1)).toThrow(
      "last Organization admin"
    )
  })

  test("allows a member removal or one admin among several", () => {
    expect(() => assertAdminRemovalIsSafe("org:member", 1)).not.toThrow()
    expect(() => assertAdminRemovalIsSafe("org:admin", 2)).not.toThrow()
  })
})
