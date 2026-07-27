import { describe, expect, test } from "bun:test"

import { documentResourceLabelKey } from "@/lib/documents"

describe("document resources", () => {
  test("uses a safe fallback while an editable document has no resource", () => {
    expect(documentResourceLabelKey(undefined)).toBe("file")
  })
})
