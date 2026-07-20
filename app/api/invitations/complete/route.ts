import { auth, clerkClient } from "@clerk/nextjs/server"

import { api } from "@/convex/_generated/api"
import { convexServerClient, safeErrorMessage } from "@/lib/server/convex"

export async function POST() {
  const { isAuthenticated, userId, orgId, getToken } = await auth()
  if (!isAuthenticated || !userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!orgId) {
    return Response.json(
      { error: "Accept the workplace invitation before continuing" },
      { status: 409 }
    )
  }
  try {
    const clerk = await clerkClient()
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    })
    const membership = memberships.data[0]
    const correlationCredential = (
      membership?.publicMetadata as Record<string, unknown> | undefined
    )?.operationsHubClaim
    if (typeof correlationCredential !== "string") {
      throw new Error("This membership is not linked to an employee profile")
    }
    const token = await getToken()
    if (!token) throw new Error("Missing Organization session token")
    const result = await convexServerClient(token).mutation(
      api.employees.claimByInvitation,
      { correlationCredential }
    )
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: safeErrorMessage(error, "Could not activate the employee profile") },
      { status: 400 }
    )
  }
}
