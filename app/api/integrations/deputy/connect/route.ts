import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { api } from "@/convex/_generated/api"
import { DEPUTY_OAUTH_AUTHORIZE_URL } from "@/lib/deputy"
import {
  convexServerClient,
  randomCredential,
  safeErrorMessage,
} from "@/lib/server/convex"
import {
  DEPUTY_OAUTH_COOKIE,
  deputyOAuthConfig,
  encodeDeputyOAuthState,
  safeDeputyReturnTo,
} from "@/lib/server/deputy-oauth"

export async function GET(request: Request) {
  const returnTo = safeDeputyReturnTo(request)
  const redirectError = (error: string) => {
    const url = new URL(returnTo, request.url)
    url.searchParams.set("deputy", "error")
    url.searchParams.set("error", error)
    return NextResponse.redirect(url)
  }
  const { isAuthenticated, orgId, getToken } = await auth()
  if (!isAuthenticated || !orgId) {
    return redirectError("notAuthenticated")
  }
  const config = deputyOAuthConfig()
  if (!config) {
    return redirectError("deputyIntegrationNotConfigured")
  }
  const token = await getToken()
  if (!token) {
    return redirectError("missingSessionToken")
  }
  try {
    const authorization = await convexServerClient(token).query(
      api.hubs.getOwnerAuthorization,
      { organizationHint: orgId }
    )
    if (!authorization.authorized) {
      return redirectError("workplaceOwnerAccessRequired")
    }
  } catch (error) {
    return redirectError(safeErrorMessage(error, "deputyOAuthExchangeFailed"))
  }

  const state = randomCredential()
  const authorizeUrl = new URL(DEPUTY_OAUTH_AUTHORIZE_URL)
  authorizeUrl.searchParams.set("client_id", config.clientId)
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri)
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("scope", "longlife_refresh_token")
  authorizeUrl.searchParams.set("state", state)
  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(
    DEPUTY_OAUTH_COOKIE,
    encodeDeputyOAuthState({
      state,
      organizationId: orgId,
      returnTo,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/api/integrations/deputy",
      maxAge: 10 * 60,
    }
  )
  return response
}
