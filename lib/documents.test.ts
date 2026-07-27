import { describe, expect, test } from "bun:test"

import { documentResourceLabel } from "@/lib/documents"

describe("document resources", () => {
  test("uses a safe fallback while an editable document has no resource", () => {
    expect(documentResourceLabel(undefined)).toBe("File")
  })
})
