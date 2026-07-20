import { auth, clerkClient } from "@clerk/nextjs/server"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  convexServerClient,
  randomCredential,
  safeErrorMessage,
} from "@/lib/server/convex"

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (
    (body.action !== "send" && body.action !== "revoke") ||
    typeof body.profileId !== "string"
  ) {
    return null
  }
  return {
    action: body.action,
    profileId: body.profileId as Id<"employeeProfiles">,
  }
}

export async function POST(request: Request) {
  const { isAuthenticated, userId, orgId, has, getToken } = await auth()
  if (!isAuthenticated || !userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (!orgId || !has({ role: "org:admin" })) {
    return Response.json(
      { error: "Workplace admin access required" },
      { status: 403 }
    )
  }
  const body = parseBody(await request.json().catch(() => null))
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 })
  const token = await getToken()
  if (!token)
    return Response.json({ error: "Missing session token" }, { status: 401 })
  const convex = convexServerClient(token)

  try {
    const record = await convex.query(api.employees.getForAdmin, {
      profileId: body.profileId,
    })
    if (record.organizationId !== orgId)
      throw new Error("Employee belongs to another workplace")
    const clerk = await clerkClient()

    if (body.action === "revoke") {
      if (record.profile.invitationId) {
        await clerk.organizations.revokeOrganizationInvitation({
          organizationId: orgId,
          invitationId: record.profile.invitationId,
          requestingUserId: userId,
        })
      }
      await convex.mutation(api.employees.markInvitationStatus, {
        profileId: body.profileId,
        status: "revoked",
      })
      return Response.json({ status: "revoked" })
    }

    if (
      record.profile.invitationId &&
      record.profile.invitationStatus === "pending"
    ) {
      try {
        await clerk.organizations.revokeOrganizationInvitation({
          organizationId: orgId,
          invitationId: record.profile.invitationId,
          requestingUserId: userId,
        })
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error
      }
    }
    const correlationCredential = randomCredential()
    const prepared = await convex.mutation(api.employees.prepareInvitation, {
      profileId: body.profileId,
      correlationCredential,
    })
    try {
      const invitation = await clerk.organizations.createOrganizationInvitation(
        {
          organizationId: orgId,
          inviterUserId: userId,
          emailAddress: prepared.email,
          role: "org:member",
          redirectUrl: new URL("/invitation/complete", request.url).toString(),
          publicMetadata: { operationsHubClaim: correlationCredential },
        }
      )
      await convex.mutation(api.employees.recordInvitation, {
        profileId: body.profileId,
        invitationId: invitation.id,
      })
      return Response.json({ status: "pending", invitationId: invitation.id })
    } catch (error) {
      await convex.mutation(api.employees.recordInvitationFailure, {
        profileId: body.profileId,
        message: safeErrorMessage(error, "Invitation failed"),
      })
      throw error
    }
  } catch (error) {
    const message = safeErrorMessage(error, "Could not update the invitation")
    const membershipLimit = /maximum|membership.*limit|too many/i.test(message)
    return Response.json(
      {
        error: membershipLimit
          ? "This workplace has reached its 20-member limit. Remove an inactive member before inviting another employee."
          : message,
      },
      { status: 400 }
    )
  }
}
