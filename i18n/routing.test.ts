import { describe, expect, test } from "bun:test"

import { getPathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { toMessageKey } from "@/i18n/use-app-translations"
import en from "@/messages/en.json"
import et from "@/messages/et.json"

describe("locale paths", () => {
  test("uses Estonian as the default and supports English", () => {
    expect(routing.defaultLocale).toBe("et")
    expect(routing.locales).toEqual(["et", "en"])
  })

  test("generates locale-prefixed application paths", () => {
    expect(getPathname({ locale: "et", href: "/guides" })).toBe("/et/guides")
    expect(getPathname({ locale: "en", href: "/calendar" })).toBe(
      "/en/calendar"
    )
  })
})

describe("translation dictionaries", () => {
  test("contain the same non-empty message keys", () => {
    expect(Object.keys(et.App).sort()).toEqual(Object.keys(en.App).sort())
    expect(Object.values(en.App).every(Boolean)).toBeTrue()
    expect(Object.values(et.App).every(Boolean)).toBeTrue()
  })

  test("keeps the existing English wording as message values", () => {
    for (const [key, value] of Object.entries(en.App)) {
      expect(toMessageKey(value)).toBe(key)
    }
  })
})
