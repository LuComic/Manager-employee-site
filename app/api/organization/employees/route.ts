import { auth, clerkClient } from "@clerk/nextjs/server"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { convexServerClient, safeErrorMessage } from "@/lib/server/convex"
import { assertAdminRemovalIsSafe } from "@/lib/server/organization-access"

type EmployeeAction =
  "deactivate" | "reactivate" | "promote" | "demote" | "reconcile"

function parseBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  const allowed: EmployeeAction[] = [
    "deactivate",
    "reactivate",
    "promote",
    "demote",
    "reconcile",
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
  const clerk = await clerkClient()

  try {
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
      const snapshot = await convex.query(api.hubs.getOwnedSnapshot, {
        nowDate: new Date().toISOString().slice(0, 10),
      })
      if (snapshot.kind !== "ready") throw new Error("Workplace not found")
      await convex.mutation(api.employees.reconcileMemberships, {
        hubId: snapshot.hub.id,
        activeClerkUserIds: memberships.data.flatMap((membership) =>
          membership.publicUserData?.userId
            ? [membership.publicUserData.userId]
            : []
        ),
      })
      const profiles = await convex.query(api.employees.list, {
        hubId: snapshot.hub.id,
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
      throw new Error("Employee belongs to another workplace")

    if (body.action === "reactivate") {
      await convex.mutation(api.employees.reactivateUnclaimed, {
        profileId: body.profileId!,
      })
      return Response.json({ status: "unclaimed" })
    }

    const targetUserId = record.profile.clerkUserId

    if (body.action === "deactivate" && !targetUserId) {
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
      await convex.mutation(api.employees.deactivateAfterClerkRemoval, {
        profileId: body.profileId!,
      })
      return Response.json({ status: "deactivated" })
    }
    if (!targetUserId)
      throw new Error("Employee does not have a linked account")
    const membershipList =
      await clerk.organizations.getOrganizationMembershipList({
        organizationId: orgId,
        userId: [targetUserId],
        limit: 1,
      })
    const membership = membershipList.data[0]

    if (body.action === "promote") {
      await clerk.organizations.updateOrganizationMembership({
        organizationId: orgId,
        userId: targetUserId,
        role: "org:admin",
      })
      return Response.json({ status: "org:admin", refreshSession: true })
    }

    if (membership?.role === "org:admin") {
      const admins = await clerk.organizations.getOrganizationMembershipList({
        organizationId: orgId,
        role: ["org:admin"],
        limit: 20,
      })
      assertAdminRemovalIsSafe(membership.role, admins.totalCount)
    }

    if (body.action === "demote") {
      await clerk.organizations.updateOrganizationMembership({
        organizationId: orgId,
        userId: targetUserId,
        role: "org:member",
      })
      return Response.json({ status: "org:member", refreshSession: true })
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
    if (membership) {
      await clerk.organizations.deleteOrganizationMembership({
        organizationId: orgId,
        userId: targetUserId,
      })
    }
    await convex.mutation(api.employees.deactivateAfterClerkRemoval, {
      profileId: body.profileId!,
    })
    return Response.json({ status: "deactivated" })
  } catch (error) {
    return Response.json(
      { error: safeErrorMessage(error, "Could not update the employee") },
      { status: 400 }
    )
  }
}
