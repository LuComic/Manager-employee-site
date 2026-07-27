import { describe, expect, test } from "bun:test"

import { normalizeMessageKeys, toMessageKey } from "@/i18n/messages"
import { getPathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
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
  test("contain only non-empty messages", () => {
    expect(Object.values(en.App).every(Boolean)).toBeTrue()
    expect(Object.values(et.App).every(Boolean)).toBeTrue()
  })

  test("normalizes dotted keys before next-intl validates messages", () => {
    for (const messages of [en, et]) {
      const normalized = normalizeMessageKeys(messages)
      expect(
        Object.keys(normalized.App).every((key) => !key.includes("."))
      ).toBeTrue()
    }
    expect(toMessageKey("First sentence. Second sentence.")).toBe(
      "First sentence․ Second sentence․"
    )
  })

  test("rejects message keys that collide after normalization", () => {
    expect(() =>
      normalizeMessageKeys({
        App: {
          "Duplicate.": "First",
          "Duplicate․": "Second",
        },
      })
    ).toThrow('both normalize to "Duplicate․"')
  })
})
