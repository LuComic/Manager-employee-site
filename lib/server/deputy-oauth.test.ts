import { describe, expect, mock, test } from "bun:test"

mock.module("server-only", () => ({}))

const { decodeDeputyOAuthState, encodeDeputyOAuthState, safeDeputyReturnPath } =
  await import("@/lib/server/deputy-oauth")

describe("Deputy OAuth state", () => {
  test("accepts signed state and rejects tampering or a different secret", () => {
    const state = {
      state: "random-state",
      organizationId: "org_123",
      returnTo: "/en/manager/apps",
    }
    const encoded = encodeDeputyOAuthState(state, "signing-secret")

    expect(decodeDeputyOAuthState(encoded, "signing-secret")).toEqual(state)
    expect(decodeDeputyOAuthState(encoded, "different-secret")).toBeNull()
    expect(
      decodeDeputyOAuthState(`${encoded.slice(0, -1)}x`, "signing-secret")
    ).toBeNull()
  })

  test("allows only the local manager apps route as a return target", () => {
    const requestUrl = new URL("https://workhal.example/api/callback")

    expect(safeDeputyReturnPath("/manager/apps", requestUrl)).toBe(
      "/manager/apps"
    )
    expect(safeDeputyReturnPath("/et/manager/apps", requestUrl)).toBe(
      "/et/manager/apps"
    )
    expect(
      safeDeputyReturnPath("https://attacker.example/manager/apps", requestUrl)
    ).toBeNull()
  })
})
