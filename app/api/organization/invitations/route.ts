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
  const { isAuthenticated, userId, orgId, getToken } = await auth()
  if (!isAuthenticated || !userId) {
    return Response.json({ error: "notAuthenticated" }, { status: 401 })
  }
  if (!orgId) {
    return Response.json(
      { error: "workplaceAdminAccessRequired" },
      { status: 403 }
    )
  }
  const body = parseBody(await request.json().catch(() => null))
  if (!body) return Response.json({ error: "invalidRequest" }, { status: 400 })
  const token = await getToken()
  if (!token)
    return Response.json({ error: "missingSessionToken" }, { status: 401 })
  const convex = convexServerClient(token)

  try {
    const authorization = await convex.query(api.hubs.getOwnerAuthorization, {
      organizationHint: orgId,
    })
    if (!authorization.authorized) {
      return Response.json(
        { error: "workplaceAdminAccessRequired" },
        { status: 403 }
      )
    }
    const record = await convex.query(api.employees.getForAdmin, {
      profileId: body.profileId,
    })
    if (record.organizationId !== orgId)
      throw new Error("employeeBelongsToAnotherWorkplace")
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
        message: safeErrorMessage(error, "invitationFailed"),
      })
      throw error
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : ""
    const message = safeErrorMessage(error, "couldNotUpdateInvitation")
    const membershipLimit = /maximum|membership.*limit|too many/i.test(
      rawMessage
    )
    return Response.json(
      {
        error: membershipLimit ? "workplaceMemberLimitReached" : message,
      },
      { status: 400 }
    )
  }
}
