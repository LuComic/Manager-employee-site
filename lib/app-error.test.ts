import { describe, expect, test } from "bun:test"

import { extractAppErrorKey } from "@/lib/app-error"

describe("extractAppErrorKey", () => {
  test("accepts a direct semantic key", () => {
    expect(extractAppErrorKey(new Error("eventTitleRequired"))).toBe(
      "eventTitleRequired"
    )
  })

  test("extracts a key from a Convex client error with its stack suffix", () => {
    expect(
      extractAppErrorKey(
        new Error(
          [
            "[CONVEX M(content:saveEvent)] [Request ID: test] Server Error",
            "Uncaught Error: eventTitleRequired",
            "    at handler (../convex/content.ts:1:1)",
            "  Called by client",
          ].join("\n")
        )
      )
    ).toBe("eventTitleRequired")
  })

  test("prefers structured Convex error data when present", () => {
    const error = Object.assign(new Error("Server Error"), {
      data: "editingAccessRequired",
    })

    expect(extractAppErrorKey(error)).toBe("editingAccessRequired")
  })

  test("rejects prose and unrelated runtime errors", () => {
    expect(extractAppErrorKey(new Error("Failed to fetch"))).toBeNull()
  })
})
