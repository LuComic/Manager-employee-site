import { describe, expect, test } from "bun:test"

import { getCustomContactName } from "@/lib/contact"

describe("workplace contact names", () => {
  test("treats the stored English default as translatable UI copy", () => {
    expect(getCustomContactName("shift lead")).toBeUndefined()
    expect(getCustomContactName(" Shift Lead ")).toBeUndefined()
  })

  test("preserves a configured person or role", () => {
    expect(getCustomContactName(" Mari ")).toBe("Mari")
    expect(getCustomContactName("")).toBeUndefined()
  })
})
