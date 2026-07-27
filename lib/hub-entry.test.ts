import { describe, expect, test } from "bun:test"

import { hubEntryHref, parseHubEntry } from "./hub-entry"

describe("hub entry links", () => {
  test("accepts a workplace ID and keeps its code in the fragment", () => {
    const entry = parseHubEntry(
      "sample-workplace",
      "ABCD-EFGH",
      "https://workhal.example"
    )
    expect(entry).toEqual({
      slug: "sample-workplace",
      credential: "ABCD-EFGH",
    })
    expect(hubEntryHref(entry!)).toBe("/?hub=sample-workplace#access=ABCD-EFGH")
  })

  test("accepts a complete private workplace link", () => {
    expect(
      parseHubEntry(
        "https://workhal.example/?hub=sample-workplace#access=private-value",
        "",
        "https://workhal.example"
      )
    ).toEqual({ slug: "sample-workplace", credential: "private-value" })
  })

  test("rejects missing or malformed workplace identifiers", () => {
    expect(parseHubEntry("", "", "https://workhal.example")).toBeNull()
    expect(
      parseHubEntry("not a valid id", "", "https://workhal.example")
    ).toBeNull()
  })
})
