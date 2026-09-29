import { describe, expect, test } from "bun:test"

import { hubEntryHref, parseHubEntry, shouldQueryPublicHub } from "./hub-entry"

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

describe("public workplace subscriptions", () => {
  const ready = {
    pathname: "/",
    hubSlug: "cafe",
    authLoading: false,
    isAuthenticated: false,
  }
  test("join stays independent of Convex, including a remembered or requested workplace", () => {
    expect(shouldQueryPublicHub({ ...ready, pathname: "/join" })).toBe(false)
    expect(
      shouldQueryPublicHub({
        ...ready,
        pathname: "/join",
        requestedHubSlug: "cafe",
      })
    ).toBe(false)
  })
  test("waits for a workplace and authentication, while preserving guest and explicit member links", () => {
    expect(shouldQueryPublicHub({ ...ready, hubSlug: "" })).toBe(false)
    expect(shouldQueryPublicHub({ ...ready, authLoading: true })).toBe(false)
    expect(shouldQueryPublicHub(ready)).toBe(true)
    expect(shouldQueryPublicHub({ ...ready, isAuthenticated: true })).toBe(
      false
    )
    expect(
      shouldQueryPublicHub({
        ...ready,
        isAuthenticated: true,
        requestedHubSlug: "cafe",
      })
    ).toBe(true)
  })
  test("auth and management pages never request public workplace data", () => {
    for (const pathname of [
      "/manager",
      "/manager/settings",
      "/sign-in",
      "/sign-up/verify",
    ]) {
      expect(shouldQueryPublicHub({ ...ready, pathname })).toBe(false)
    }
  })
})
