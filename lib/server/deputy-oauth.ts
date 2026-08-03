import "server-only"

import { normalizeDeputyEndpoint } from "@/lib/deputy"

export const DEPUTY_OAUTH_COOKIE = "workhal-deputy-oauth"

export type DeputyOAuthState = {
  state: string
  organizationId: string
  returnTo: string
}

export function encodeDeputyOAuthState(value: DeputyOAuthState) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

export function decodeDeputyOAuthState(value?: string) {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    )
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("state" in parsed) ||
      typeof parsed.state !== "string" ||
      !("organizationId" in parsed) ||
      typeof parsed.organizationId !== "string" ||
      !("returnTo" in parsed) ||
      typeof parsed.returnTo !== "string"
    ) {
      return null
    }
    return parsed as DeputyOAuthState
  } catch {
    return null
  }
}

export function safeDeputyReturnTo(request: Request) {
  const requestUrl = new URL(request.url)
  const explicit = requestUrl.searchParams.get("returnTo")
  const referer = request.headers.get("referer")
  for (const candidate of [explicit, referer]) {
    if (!candidate) continue
    try {
      const url = new URL(candidate, requestUrl.origin)
      if (
        url.origin === requestUrl.origin &&
        /^\/(?:[a-z]{2}\/)?manager\/apps\/?$/.test(url.pathname)
      ) {
        return url.pathname
      }
    } catch {
      // Ignore malformed return paths.
    }
  }
  return "/manager/apps"
}

export function deputyOAuthConfig() {
  const clientId = process.env.DEPUTY_CLIENT_ID?.trim()
  const clientSecret = process.env.DEPUTY_CLIENT_SECRET?.trim()
  const redirectUri = process.env.DEPUTY_OAUTH_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) return null
  return { clientId, clientSecret, redirectUri }
}

export function parseDeputyTokenResponse(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const response = value as Record<string, unknown>
  const endpoint =
    typeof response.endpoint === "string"
      ? normalizeDeputyEndpoint(response.endpoint)
      : null
  if (
    typeof response.access_token !== "string" ||
    !response.access_token ||
    typeof response.refresh_token !== "string" ||
    !response.refresh_token ||
    typeof response.expires_in !== "number" ||
    !Number.isFinite(response.expires_in) ||
    !endpoint
  ) {
    return null
  }
  return {
    endpoint,
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresInSeconds: response.expires_in,
  }
}
