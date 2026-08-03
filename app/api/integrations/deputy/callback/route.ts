import { auth } from "@clerk/nextjs/server"
import { type NextRequest, NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import { DEPUTY_OAUTH_TOKEN_URL } from "@/lib/deputy"
import { convexServerClient, safeErrorMessage } from "@/lib/server/convex"
import {
  DEPUTY_OAUTH_COOKIE,
  decodeDeputyOAuthState,
  deputyOAuthConfig,
  parseDeputyTokenResponse,
  safeDeputyReturnPath,
} from "@/lib/server/deputy-oauth"

function redirectResult(
  request: NextRequest,
  returnTo: string,
  result: "connected" | "error",
  error?: string
) {
  const url = new URL(returnTo, request.url)
  url.searchParams.set("deputy", result)
  if (error) url.searchParams.set("error", error)
  const response = NextResponse.redirect(url)
  response.cookies.set(DEPUTY_OAUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/api/integrations/deputy",
    maxAge: 0,
  })
  return response
}

export async function GET(request: NextRequest) {
  const config = deputyOAuthConfig()
  const stored = config
    ? decodeDeputyOAuthState(
        request.cookies.get(DEPUTY_OAUTH_COOKIE)?.value,
        config.clientSecret
      )
    : null
  const returnTo = stored
    ? (safeDeputyReturnPath(stored.returnTo, request.nextUrl) ??
      "/manager/apps")
    : "/manager/apps"
  if (!config) {
    return redirectResult(
      request,
      returnTo,
      "error",
      "deputyIntegrationNotConfigured"
    )
  }
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  if (!stored || !code || !state || state !== stored.state) {
    return redirectResult(request, returnTo, "error", "deputyOAuthInvalid")
  }
  const { isAuthenticated, orgId, getToken } = await auth()
  if (!isAuthenticated || !orgId || orgId !== stored.organizationId) {
    return redirectResult(
      request,
      returnTo,
      "error",
      "workplaceOwnerAccessRequired"
    )
  }
  try {
    const response = await fetch(DEPUTY_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code,
        scope: "longlife_refresh_token",
      }),
    })
    if (!response.ok) throw new Error("deputyOAuthExchangeFailed")
    const deputyToken = parseDeputyTokenResponse(await response.json())
    if (!deputyToken) throw new Error("deputyOAuthExchangeFailed")
    const me = await fetch(`https://${deputyToken.endpoint}/api/v1/me`, {
      headers: { Authorization: `Bearer ${deputyToken.accessToken}` },
    })
    if (!me.ok) throw new Error("deputyOAuthValidationFailed")

    const token = await getToken()
    if (!token) throw new Error("missingSessionToken")
    const convex = convexServerClient(token)
    const authorization = await convex.query(api.hubs.getOwnerAuthorization, {
      organizationHint: orgId,
    })
    if (!authorization.authorized) {
      throw new Error("workplaceOwnerAccessRequired")
    }
    await convex.mutation(api.deputy.connect, {
      hubId: authorization.hubId,
      ...deputyToken,
    })
    return redirectResult(request, returnTo, "connected")
  } catch (error) {
    return redirectResult(
      request,
      returnTo,
      "error",
      safeErrorMessage(error, "deputyOAuthExchangeFailed")
    )
  }
}
