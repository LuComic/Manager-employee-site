import { describe, expect, test } from "bun:test"

import en from "@/messages/en.json"
import et from "@/messages/et.json"
import {
  getLocaleFromPathname,
  localizeHref,
  stripLocaleFromPathname,
} from "@/i18n/config"

describe("locale paths", () => {
  test("detects and removes supported locale prefixes", () => {
    expect(getLocaleFromPathname("/et/guides")).toBe("et")
    expect(getLocaleFromPathname("/en")).toBe("en")
    expect(getLocaleFromPathname("/guides")).toBeNull()
    expect(stripLocaleFromPathname("/et/guides/example")).toBe(
      "/guides/example"
    )
    expect(stripLocaleFromPathname("/en")).toBe("/")
  })

  test("localizes internal links while preserving suffixes", () => {
    expect(localizeHref("/guides?hub=example#start", "et")).toBe(
      "/et/guides?hub=example#start"
    )
    expect(localizeHref("/et/calendar", "en")).toBe("/en/calendar")
    expect(localizeHref("https://example.com", "et")).toBe(
      "https://example.com"
    )
    expect(localizeHref("/api/workplaces", "et")).toBe("/api/workplaces")
  })
})

describe("translation dictionaries", () => {
  test("contain the same non-empty message keys", () => {
    expect(Object.keys(et).sort()).toEqual(Object.keys(en).sort())
    expect(Object.values(en).every(Boolean)).toBeTrue()
    expect(Object.values(et).every(Boolean)).toBeTrue()
  })
})
