import { describe, expect, test } from "bun:test"

import { SITE_NAME, workspaceDocumentTitle } from "@/lib/branding"

describe("workspace document titles", () => {
  test("uses the active establishment name for the default title", () => {
    expect(workspaceDocumentTitle(SITE_NAME, "Merevaade")).toBe("Merevaade")
  })

  test("preserves a page-specific title prefix", () => {
    expect(workspaceDocumentTitle(`Search | ${SITE_NAME}`, "Merevaade")).toBe(
      "Search | Merevaade"
    )
  })

  test("updates a renamed active establishment", () => {
    expect(
      workspaceDocumentTitle("Search | Merevaade", "Rannakohvik", "Merevaade")
    ).toBe("Search | Rannakohvik")
  })

  test("restores the site name after leaving the establishment", () => {
    expect(workspaceDocumentTitle("Merevaade", null, "Merevaade")).toBe(
      SITE_NAME
    )
  })

  test("leaves unrelated titles unchanged", () => {
    expect(workspaceDocumentTitle("Sign in", "Merevaade")).toBe("Sign in")
  })
})
