import { describe, expect, test } from "bun:test"

import { clerkLocalizationByLocale } from "@/lib/clerk-localization"

describe("Clerk localization", () => {
  test("uses Clerk's default English copy for English routes", () => {
    expect(clerkLocalizationByLocale.en).toBeUndefined()
  })

  test("uses custom Estonian copy for Estonian routes", () => {
    expect(clerkLocalizationByLocale.et.locale).toBe("et-EE")
    expect(clerkLocalizationByLocale.et.signIn?.start.title).toBe(
      "Logi workhali sisse"
    )
    expect(JSON.stringify(clerkLocalizationByLocale.et)).not.toMatch(/keskus/i)
  })
})
