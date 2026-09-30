import { describe, expect, test } from "bun:test"
import { vercelDeploymentError } from "./vercel-deployment"

describe("matched Vercel/Convex releases", () => {
  test.each(["production", "preview"])(
    "requires a deploy key for %s",
    (VERCEL_ENV) => {
      expect(vercelDeploymentError({ VERCEL_ENV })).toContain(
        "Set CONVEX_DEPLOY_KEY"
      )
    }
  )
  test("accepts separately scoped production and preview keys", () => {
    expect(
      vercelDeploymentError({
        VERCEL_ENV: "production",
        CONVEX_DEPLOY_KEY: "prod:example|fixture",
      })
    ).toBeNull()
    expect(
      vercelDeploymentError({
        VERCEL_ENV: "preview",
        CONVEX_DEPLOY_KEY: "preview:team:project|fixture",
      })
    ).toBeNull()
  })
  test.each([
    "prod:example|fixture",
    "dev:example|fixture",
    "project:team:project|fixture",
    "local|fixture",
  ])(
    "previews reject broader or non-preview keys (%s)",
    (CONVEX_DEPLOY_KEY) => {
      expect(
        vercelDeploymentError({ VERCEL_ENV: "preview", CONVEX_DEPLOY_KEY })
      ).toContain("preview-scoped")
    }
  )
  test("production rejects preview keys", () => {
    expect(
      vercelDeploymentError({
        VERCEL_ENV: "production",
        CONVEX_DEPLOY_KEY: "preview:team:project|fixture",
      })
    ).toContain("prod-scoped")
  })
  test.each([
    "prod:example",
    "prod:example|",
    "prod:example|fixture with spaces",
  ])(
    "rejects malformed keys without echoing their contents (%s)",
    (CONVEX_DEPLOY_KEY) => {
      const error = vercelDeploymentError({
        VERCEL_ENV: "production",
        CONVEX_DEPLOY_KEY,
      })
      expect(error).toContain("prod-scoped")
      expect(error).not.toContain(CONVEX_DEPLOY_KEY)
    }
  )
  test("local builds use the normal build command without remote deployment", () => {
    expect(vercelDeploymentError({})).toContain("Use bun run build")
  })
})
