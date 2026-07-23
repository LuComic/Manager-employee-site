import { describe, expect, test } from "bun:test"

import {
  guideStepsToRichText,
  isRichTextEmpty,
  normalizeRichTextLink,
  paragraphDocument,
  richTextToPlainText,
} from "@/lib/rich-text"

describe("rich text helpers", () => {
  test("converts guide steps into searchable rich text", () => {
    const content = guideStepsToRichText([
      {
        title: "Open the till",
        detail: "Count the float.",
        tip: "Count twice.",
      },
    ])

    expect(content.content?.[0]?.type).toBe("orderedList")
    expect(richTextToPlainText(content)).toBe(
      "Open the till Count the float. Useful tip: Count twice."
    )
  })

  test("detects empty and non-empty documents", () => {
    expect(isRichTextEmpty(paragraphDocument(""))).toBe(true)
    expect(isRichTextEmpty(paragraphDocument("Ready"))).toBe(false)
  })

  test("normalizes safe links and rejects unsafe protocols", () => {
    expect(normalizeRichTextLink("example.com")).toBe("https://example.com")
    expect(normalizeRichTextLink("mailto:team@example.com")).toBe(
      "mailto:team@example.com"
    )
    expect(normalizeRichTextLink("javascript:alert(1)")).toBeNull()
  })
})
