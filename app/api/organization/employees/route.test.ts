import { beforeEach, describe, expect, mock, test } from "bun:test"
import { getFunctionName, type FunctionReference } from "convex/server"

const calls: string[] = []
let membershipExists = true
let membershipDeletionError: Error | null = null
let finalizationError: Error | null = null

const convex = {
  query: async (reference: FunctionReference<"query">) => {
    const name = getFunctionName(reference)
    calls.push(`convex:${name}`)
    if (name === "hubs:getOwnerAuthorization") {
      return { authorized: true, hubId: "hub-a" }
    }
    if (name === "employees:getForAdmin") {
      return {
        profile: {
          id: "profile-a",
          displayName: "Employee A",
          clerkUserId: "employee-a",
          invitationStatus: "accepted",
          status: "active",
        },
        organizationId: "org-a",
        hubSlug: "workplace-a",
        hasShiftTrades: false,
        hasProcessingShiftTrade: false,
      }
    }
    throw new Error(`Unexpected query: ${name}`)
  },
  mutation: async (reference: FunctionReference<"mutation">) => {
    const name = getFunctionName(reference)
    calls.push(`convex:${name}`)
    if (name === "employees:prepareClerkRemoval") {
      return { operationId: "operation-a" }
    }
    if (name === "employees:deactivateAfterClerkRemoval") {
      if (finalizationError) throw finalizationError
      return null
    }
    if (name === "employees:abortClerkRemoval") return null
    throw new Error(`Unexpected mutation: ${name}`)
  },
}

const clerk = {
  organizations: {
    getOrganizationMembershipList: async () => ({
      data: membershipExists ? [{ role: "org:member" }] : [],
      totalCount: membershipExists ? 1 : 0,
    }),
    getOrganizationInvitationList: async () => ({ data: [] }),
    revokeOrganizationInvitation: async () => undefined,
    deleteOrganizationMembership: async () => {
      calls.push("clerk:deleteOrganizationMembership")
      if (membershipDeletionError) throw membershipDeletionError
    },
  },
}

mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({
    isAuthenticated: true,
    userId: "owner-a",
    orgId: "org-a",
    getToken: async () => "session-token",
  }),
  clerkClient: async () => clerk,
}))

mock.module("@/lib/server/convex", () => ({
  convexServerClient: () => convex,
  safeErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}))

const { POST } = await import("./route")

function employeeRequest() {
  return new Request("https://workhal.example/api/organization/employees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "deactivate", profileId: "profile-a" }),
  })
}

beforeEach(() => {
  calls.length = 0
  membershipExists = true
  membershipDeletionError = null
  finalizationError = null
})

describe("employee Clerk removal coordination", () => {
  test("reserves Convex first and keeps the operation resumable after an ambiguous Clerk failure", async () => {
    membershipDeletionError = new Error("clerkTimeout")

    const response = await POST(employeeRequest())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "clerkTimeout" })
    expect(calls).toEqual([
      "convex:hubs:getOwnerAuthorization",
      "convex:employees:getForAdmin",
      "convex:employees:prepareClerkRemoval",
      "clerk:deleteOrganizationMembership",
    ])
  })

  test("rolls back the reservation when Convex finalization fails before any Clerk mutation", async () => {
    membershipExists = false
    finalizationError = new Error("convexFinalizationFailed")

    const response = await POST(employeeRequest())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "convexFinalizationFailed",
    })
    expect(calls).toEqual([
      "convex:hubs:getOwnerAuthorization",
      "convex:employees:getForAdmin",
      "convex:employees:prepareClerkRemoval",
      "convex:employees:deactivateAfterClerkRemoval",
      "convex:employees:abortClerkRemoval",
    ])
  })

  test("finishes a resumed deactivation after Clerk membership is already absent", async () => {
    membershipExists = false

    const response = await POST(employeeRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: "deactivated",
      refreshSession: false,
    })
    expect(calls).toEqual([
      "convex:hubs:getOwnerAuthorization",
      "convex:employees:getForAdmin",
      "convex:employees:prepareClerkRemoval",
      "convex:employees:deactivateAfterClerkRemoval",
    ])
  })
})
