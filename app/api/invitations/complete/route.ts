import { auth, clerkClient } from "@clerk/nextjs/server"

import { api } from "@/convex/_generated/api"
import { convexServerClient, safeErrorMessage } from "@/lib/server/convex"

export async function POST() {
  const { isAuthenticated, userId, orgId, getToken } = await auth()
  if (!isAuthenticated || !userId) {
    return Response.json({ error: "notAuthenticated" }, { status: 401 })
  }
  if (!orgId) {
    return Response.json(
      { error: "acceptWorkplaceInvitationBeforeContinuing" },
      { status: 409 }
    )
  }
  try {
    const clerk = await clerkClient()
    const memberships = await clerk.organizations.getOrganizationMembershipList(
      {
        organizationId: orgId,
        userId: [userId],
        limit: 1,
      }
    )
    const membership = memberships.data[0]
    const correlationCredential = (
      membership?.publicMetadata as Record<string, unknown> | undefined
    )?.workhalClaim
    if (typeof correlationCredential !== "string") {
      throw new Error("membershipNotLinkedEmployeeProfile")
    }
    const token = await getToken()
    if (!token) throw new Error("missingWorkplaceSessionToken")
    const result = await convexServerClient(token).mutation(
      api.employees.activateByInvitation,
      { correlationCredential }
    )
    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        error: safeErrorMessage(error, "couldNotActivateProfile"),
      },
      { status: 400 }
    )
  }
}
