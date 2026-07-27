import { auth, clerkClient } from "@clerk/nextjs/server"

import { safeErrorMessage } from "@/lib/server/convex"

export async function POST() {
  const { isAuthenticated, orgId, has } = await auth()
  if (!isAuthenticated) {
    return Response.json({ error: "notAuthenticated" }, { status: 401 })
  }
  if (!orgId || !has({ role: "org:admin" })) {
    return Response.json(
      { error: "selectWorkplaceYouAdminister" },
      { status: 403 }
    )
  }

  try {
    const clerk = await clerkClient()
    await clerk.organizations.updateOrganization(orgId, {
      maxAllowedMemberships: 20,
    })
    return Response.json({ organizationId: orgId })
  } catch (error) {
    return Response.json(
      { error: safeErrorMessage(error, "couldNotConfigureWorkplace") },
      { status: 400 }
    )
  }
}
