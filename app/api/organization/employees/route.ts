import { auth, clerkClient } from "@clerk/nextjs/server"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { convexServerClient, safeErrorMessage } from "@/lib/server/convex"
import { assertAdminRemovalIsSafe } from "@/lib/server/organization-access"

type EmployeeAction = "deactivate" | "reactivate" | "reconcile" | "remove"

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const allowed: EmployeeAction[] = [
    "deactivate",
    "reactivate",
    "reconcile",
    "remove",
  ]
  if (
    typeof body.action !== "string" ||
    !allowed.includes(body.action as EmployeeAction)
  ) {
    return null
  }
  if (body.action !== "reconcile" && typeof body.profileId !== "string")
    return null
  return {
    action: body.action as EmployeeAction,
    profileId: body.profileId as Id<"employeeProfiles"> | undefined,
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
  const clerk = await clerkClient()
  let preparedRemoval: {
    profileId: Id<"employeeProfiles">
    operationId: string
  } | null = null
  let preparedRemovalMustResume = false

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
    if (body.action === "reconcile") {
      const [memberships, invitations] = await Promise.all([
        clerk.organizations.getOrganizationMembershipList({
          organizationId: orgId,
          limit: 20,
        }),
        clerk.organizations.getOrganizationInvitationList({
          organizationId: orgId,
          status: ["pending", "accepted", "revoked", "expired"],
          limit: 100,
        }),
      ])
      await convex.mutation(api.employees.reconcileMemberships, {
        hubId: authorization.hubId,
        activeClerkUserIds: memberships.data.flatMap((membership) =>
          membership.publicUserData?.userId
            ? [membership.publicUserData.userId]
            : []
        ),
      })
      const profiles = await convex.query(api.employees.list, {
        hubId: authorization.hubId,
      })
      const statuses = new Map(
        invitations.data.flatMap((invitation) =>
          invitation.status ? [[invitation.id, invitation.status] as const] : []
        )
      )
      await Promise.all(
        profiles.flatMap((profile) => {
          const invitationStatus = profile.invitationId
            ? statuses.get(profile.invitationId)
            : undefined
          return invitationStatus
            ? [
                convex.mutation(api.employees.markInvitationStatus, {
                  profileId: profile.id,
                  status: invitationStatus,
                }),
              ]
            : []
        })
      )
      return Response.json({ status: "reconciled" })
    }

    const record = await convex.query(api.employees.getForAdmin, {
      profileId: body.profileId!,
    })
    if (record.organizationId !== orgId)
      throw new Error("employeeBelongsToAnotherWorkplace")
    if (body.action === "remove" && record.hasShiftTrades) {
      throw new Error("employeeHasShiftTrades")
    }
    if (body.action === "deactivate" && record.hasProcessingShiftTrade) {
      throw new Error("employeeHasTradeApprovalInProgress")
    }

    if (body.action === "reactivate") {
      await convex.mutation(api.employees.reactivateUnclaimed, {
        profileId: body.profileId!,
      })
      return Response.json({ status: "unclaimed" })
    }

    const targetUserId = record.profile.clerkUserId

    const membershipList = targetUserId
      ? await clerk.organizations.getOrganizationMembershipList({
          organizationId: orgId,
          userId: [targetUserId],
          limit: 1,
        })
      : null
    const membership = membershipList?.data[0]

    if (membership?.role === "org:admin") {
      const admins = await clerk.organizations.getOrganizationMembershipList({
        organizationId: orgId,
        role: ["org:admin"],
        limit: 20,
      })
      assertAdminRemovalIsSafe(membership.role, admins.totalCount)
    }

    const { operationId } = await convex.mutation(
      api.employees.prepareClerkRemoval,
      {
        profileId: body.profileId!,
        action: body.action,
      }
    )
    preparedRemoval = { profileId: body.profileId!, operationId }

    if (
      record.profile.invitationId &&
      record.profile.invitationStatus === "pending"
    ) {
      // Clerk mutations can succeed remotely even when the request reports a
      // timeout. From this point onward, keep the Convex reservation so a retry
      // reconciles forward instead of restoring access to a possibly removed
      // membership.
      preparedRemovalMustResume = true
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
    if (membership && targetUserId) {
      preparedRemovalMustResume = true
      await clerk.organizations.deleteOrganizationMembership({
        organizationId: orgId,
        userId: targetUserId,
      })
    }

    if (body.action === "remove") {
      // Batch cleanup is intentionally resumable and may already have deleted
      // historical records if a later request fails.
      preparedRemovalMustResume = true
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const result = await convex.mutation(api.employees.removeProfileBatch, {
          profileId: body.profileId!,
          operationId,
        })
        if (result.removed) {
          return Response.json({
            status: "removed",
            refreshSession: targetUserId === userId,
          })
        }
      }
      throw new Error("employeeRemovalCouldNotBeCompleted")
    }

    await convex.mutation(api.employees.deactivateAfterClerkRemoval, {
      profileId: body.profileId!,
      operationId,
    })
    return Response.json({
      status: "deactivated",
      refreshSession: targetUserId === userId,
    })
  } catch (error) {
    if (preparedRemoval && !preparedRemovalMustResume) {
      await convex
        .mutation(api.employees.abortClerkRemoval, preparedRemoval)
        .catch(() => undefined)
    }
    return Response.json(
      { error: safeErrorMessage(error, "couldNotUpdateEmployee") },
      { status: 400 }
    )
  }
}
