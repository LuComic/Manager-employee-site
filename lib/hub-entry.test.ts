import { describe, expect, test } from "bun:test"

import { hubEntryHref, parseHubEntry } from "./hub-entry"

describe("hub entry links", () => {
  test("accepts a workplace ID and keeps its code in the fragment", () => {
    const entry = parseHubEntry(
      "north-pine",
      "ABCD-EFGH",
      "https://operations.example"
    )
    expect(entry).toEqual({ slug: "north-pine", credential: "ABCD-EFGH" })
    expect(hubEntryHref(entry!)).toBe(
      "/?hub=north-pine#access=ABCD-EFGH"
    )
  })

  test("accepts a complete private workplace link", () => {
    expect(
      parseHubEntry(
        "https://operations.example/?hub=north-pine#access=private-value",
        "",
        "https://operations.example"
      )
    ).toEqual({ slug: "north-pine", credential: "private-value" })
  })

  test("rejects missing or malformed workplace identifiers", () => {
    expect(parseHubEntry("", "", "https://operations.example")).toBeNull()
    expect(
      parseHubEntry("not a valid id", "", "https://operations.example")
    ).toBeNull()
  })
})
