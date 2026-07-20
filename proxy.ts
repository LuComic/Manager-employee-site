import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

export default clerkMiddleware(async (auth, request) => {
  const { nextUrl } = request
  if (nextUrl.pathname !== "/" || nextUrl.searchParams.has("hub")) return

  const { isAuthenticated, orgId } = await auth()
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/join", request.url))
  }
  if (!orgId) {
    return NextResponse.redirect(new URL("/manager", request.url))
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
