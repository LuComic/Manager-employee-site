import { clerkMiddleware } from "@clerk/nextjs/server"
import { hasLocale } from "next-intl"
import createMiddleware from "next-intl/middleware"
import { NextResponse } from "next/server"

import { routing } from "@/i18n/routing"

const handleI18nRouting = createMiddleware(routing)

function copyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie)
  }
  return target
}

export default clerkMiddleware(async (auth, request) => {
  const { nextUrl } = request
  if (
    nextUrl.pathname.startsWith("/api/") ||
    nextUrl.pathname.startsWith("/trpc/")
  ) {
    return NextResponse.next()
  }

  const localeResponse = handleI18nRouting(request)
  if (!localeResponse.ok) return localeResponse

  const [, locale, ...segments] = nextUrl.pathname.split("/")
  if (!hasLocale(routing.locales, locale)) return localeResponse
  const pathname = `/${segments.join("/")}`
  if (pathname !== "/" || nextUrl.searchParams.has("hub")) return localeResponse

  const { isAuthenticated, orgId } = await auth()
  if (!isAuthenticated) {
    return copyCookies(
      localeResponse,
      NextResponse.redirect(new URL(`/${locale}/join`, request.url))
    )
  }
  if (!orgId) {
    return copyCookies(
      localeResponse,
      NextResponse.redirect(new URL(`/${locale}/manager`, request.url))
    )
  }
  return localeResponse
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
