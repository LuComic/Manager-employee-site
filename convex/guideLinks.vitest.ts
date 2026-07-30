import { describe, expect, test } from "vitest"

import {
  assertGuideLinkReplacementFits,
  assertGuideLinksPerHub,
  assertGuideLinksPerItem,
  MAX_GUIDE_LINKS_PER_HUB,
  MAX_GUIDE_LINKS_PER_ITEM,
} from "./lib/guideLinks"

describe("guide link limits", () => {
  test("accepts complete item and hub relation sets at their limits", () => {
    expect(() =>
      assertGuideLinksPerItem(MAX_GUIDE_LINKS_PER_ITEM)
    ).not.toThrow()
    expect(() => assertGuideLinksPerHub(MAX_GUIDE_LINKS_PER_HUB)).not.toThrow()
    expect(() =>
      assertGuideLinkReplacementFits({
        hubCount: MAX_GUIDE_LINKS_PER_HUB,
        previousCount: 10,
        nextCount: 10,
      })
    ).not.toThrow()
  })

  test("rejects item, hub, and replacement counts instead of truncating", () => {
    expect(() => assertGuideLinksPerItem(MAX_GUIDE_LINKS_PER_ITEM + 1)).toThrow(
      "tooManyRelatedGuides"
    )
    expect(() => assertGuideLinksPerHub(MAX_GUIDE_LINKS_PER_HUB + 1)).toThrow(
      "tooManyRelatedGuideLinksForWorkplace"
    )
    expect(() =>
      assertGuideLinkReplacementFits({
        hubCount: MAX_GUIDE_LINKS_PER_HUB,
        previousCount: 1,
        nextCount: 2,
      })
    ).toThrow("tooManyRelatedGuideLinksForWorkplace")
  })
})
