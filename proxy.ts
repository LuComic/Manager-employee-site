import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import {
  defaultLocale,
  getLocaleFromPathname,
  isLocale,
  localeCookieName,
  stripLocaleFromPathname,
} from "@/i18n/config"

export default clerkMiddleware(async (auth, request) => {
  const { nextUrl } = request
  if (nextUrl.pathname.startsWith("/api/")) return

  const pathnameLocale = getLocaleFromPathname(nextUrl.pathname)
  if (!pathnameLocale) {
    const preferredLocale = request.cookies.get(localeCookieName)?.value
    const locale =
      preferredLocale && isLocale(preferredLocale)
        ? preferredLocale
        : defaultLocale
    const localizedUrl = nextUrl.clone()
    localizedUrl.pathname = `/${locale}${
      nextUrl.pathname === "/" ? "" : nextUrl.pathname
    }`
    return NextResponse.redirect(localizedUrl)
  }

  const pathname = stripLocaleFromPathname(nextUrl.pathname)
  const localeResponse = NextResponse.next()
  localeResponse.cookies.set(localeCookieName, pathnameLocale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  })
  if (pathname !== "/" || nextUrl.searchParams.has("hub")) return localeResponse

  const { isAuthenticated, orgId } = await auth()
  if (!isAuthenticated) {
    const response = NextResponse.redirect(
      new URL(`/${pathnameLocale}/join`, request.url)
    )
    response.cookies.set(localeCookieName, pathnameLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    })
    return response
  }
  if (!orgId) {
    const response = NextResponse.redirect(
      new URL(`/${pathnameLocale}/manager`, request.url)
    )
    response.cookies.set(localeCookieName, pathnameLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    })
    return response
  }
  return localeResponse
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
