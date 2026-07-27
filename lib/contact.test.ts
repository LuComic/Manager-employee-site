import { describe, expect, test } from "bun:test"

import { getCustomContactName } from "@/lib/contact"

describe("workplace contact names", () => {
  test("treats both locale defaults as translatable UI copy", () => {
    expect(getCustomContactName("shift lead")).toBeUndefined()
    expect(getCustomContactName(" Shift Lead ")).toBeUndefined()
    expect(getCustomContactName("vahetusvanem")).toBeUndefined()
    expect(getCustomContactName(" Vahetusvanem ")).toBeUndefined()
  })

  test("preserves a configured person or role", () => {
    expect(getCustomContactName(" Mari ")).toBe("Mari")
    expect(getCustomContactName("")).toBeUndefined()
  })
})
