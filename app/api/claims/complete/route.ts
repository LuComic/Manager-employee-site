import { auth, clerkClient } from "@clerk/nextjs/server"

import { api } from "@/convex/_generated/api"
import { convexServerClient, safeErrorMessage } from "@/lib/server/convex"

function credentialFrom(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const credential = (value as Record<string, unknown>).credential
  return typeof credential === "string" ? credential : null
}

export async function POST(request: Request) {
  const { isAuthenticated, userId, getToken } = await auth()
  if (!isAuthenticated || !userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  const credential = credentialFrom(await request.json().catch(() => null))
  if (!credential) return Response.json({ error: "Invalid claim request" }, { status: 400 })
  try {
    const personalToken = await getToken()
    if (!personalToken) throw new Error("Missing session token")
    const personalConvex = convexServerClient(personalToken)
    const target = await personalConvex.query(
      api.employees.resolveClaimForAuthenticatedUser,
      { credential, now: Date.now() }
    )
    const clerk = await clerkClient()
    try {
      await clerk.organizations.createOrganizationMembership({
        organizationId: target.organizationId,
        userId,
        role: "org:member",
      })
    } catch (error) {
      const status = (error as { status?: number }).status
      const message = safeErrorMessage(error, "Could not join the workplace")
      if (status !== 409 && !/already.*member|already exists/i.test(message)) throw error
    }
    return Response.json({
      organizationId: target.organizationId,
      hubSlug: target.hubSlug,
    })
  } catch (error) {
    return Response.json(
      { error: safeErrorMessage(error, "Could not claim the employee profile") },
      { status: 400 }
    )
  }
}
