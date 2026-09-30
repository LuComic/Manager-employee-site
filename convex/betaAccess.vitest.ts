/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import schema from "./schema"

const clerk = vi.hoisted(() => ({
  users: { getUser: vi.fn(), getUserList: vi.fn(), updateUser: vi.fn() },
  organizations: {
    getOrganizationMembershipList: vi.fn(),
    createOrganizationMembership: vi.fn(),
    deleteOrganizationMembership: vi.fn(),
  },
  allowlistIdentifiers: {
    getAllowlistIdentifierList: vi.fn(),
    createAllowlistIdentifier: vi.fn(),
    deleteAllowlistIdentifier: vi.fn(),
  },
  instance: { updateRestrictions: vi.fn() },
}))
vi.mock("@clerk/backend", () => ({ createClerkClient: () => clerk }))
const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "owner",
  issuer: "https://clerk.test",
  tokenIdentifier: "https://clerk.test|owner",
  org_id: "org-a",
  org_role: "org:admin",
}
const employeeIdentity = {
  subject: "employee",
  issuer: "https://clerk.test",
  tokenIdentifier: "https://clerk.test|employee",
  org_id: "org-a",
  org_role: "org:member",
}
const hubArgs = {
  name: "Test workplace",
  slug: "test",
  accessMode: "restricted" as const,
  joinCode: "ABCD-EFGH",
  privateToken: "a".repeat(40),
  timeZone: "Europe/Tallinn",
}
function mockUser(verified = true) {
  return {
    id: "employee",
    createOrganizationEnabled: false,
    emailAddresses: [
      {
        emailAddress: "EMPLOYEE@example.com",
        verification: { status: verified ? "verified" : "unverified" },
      },
    ],
  }
}
async function fixture() {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity(ownerIdentity)
  const { hubId } = await owner.mutation(api.hubs.create, hubArgs)
  const profileId = await owner.mutation(api.employees.create, {
    hubId,
    displayName: "Employee",
    email: "Employee@example.com",
  })
  await t.run(async (ctx) => {
    await ctx.db.insert("betaPolicy", {
      key: "signup",
      enabled: true,
      creatorEmails: ["owner@example.com"],
    })
    await ctx.db.insert("accountEmails", {
      clerkUserId: "owner",
      verifiedEmails: ["owner@example.com"],
    })
  })
  return {
    t,
    owner,
    hubId,
    profileId,
    employee: t.withIdentity(employeeIdentity),
  }
}
beforeEach(() => {
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fixture")
  vi.resetAllMocks()
  clerk.users.getUser.mockResolvedValue(mockUser())
  clerk.users.getUserList.mockResolvedValue({
    data: [mockUser()],
    totalCount: 1,
  })
  clerk.organizations.getOrganizationMembershipList.mockResolvedValue({
    data: [],
  })
  clerk.organizations.createOrganizationMembership.mockResolvedValue({})
  clerk.allowlistIdentifiers.getAllowlistIdentifierList.mockResolvedValue({
    data: [],
    totalCount: 0,
  })
})
afterEach(() => vi.unstubAllEnvs())

describe("beta employee accounts", () => {
  test("verified employee signup links the existing profile as a member without an invitation", async () => {
    const { t, employee, profileId, hubId } = await fixture()
    expect(await employee.action(api.betaClerk.connectAccount, {})).toEqual([
      { organizationId: "org-a", hubSlug: "test" },
    ])
    expect(
      clerk.organizations.createOrganizationMembership
    ).toHaveBeenCalledWith({
      organizationId: "org-a",
      userId: "employee",
      role: "org:member",
    })
    expect(
      await t.run((ctx) => ctx.db.get("employeeProfiles", profileId))
    ).toMatchObject({
      clerkUserId: "employee",
      status: "active",
      accessLevel: "viewer",
    })
    expect(await employee.query(api.betaAccess.getMyAccess, {})).toEqual({
      canCreateOrganization: false,
    })
    const snapshot = await employee.query(api.hubs.getActiveMemberSnapshot, {
      nowDate: "2026-09-30",
      organizationHint: "org-a",
    })
    expect(snapshot?.kind).toBe("ready")
    await expect(
      employee.mutation(api.employees.create, {
        hubId,
        displayName: "Unauthorized",
      })
    ).rejects.toThrow("workplaceOwnerAccessRequired")
    await expect(
      t
        .withIdentity({
          ...employeeIdentity,
          org_id: "org-other",
          org_role: "org:admin",
        })
        .mutation(api.hubs.create, { ...hubArgs, slug: "other" })
    ).rejects.toThrow("betaCreatorApprovalRequired")
  })
  test("unverified email cannot claim an employee or receive creator approval", async () => {
    const { employee } = await fixture()
    clerk.users.getUser.mockResolvedValue(mockUser(false))
    expect(await employee.action(api.betaClerk.connectAccount, {})).toEqual([])
    expect(
      clerk.organizations.createOrganizationMembership
    ).not.toHaveBeenCalled()
    expect(await employee.query(api.betaAccess.getMyAccess, {})).toEqual({
      canCreateOrganization: false,
    })
  })
  test("deactivated, pending-removal and already-claimed profiles cannot be claimed", async () => {
    for (const patch of [
      { status: "deactivated" as const },
      { pendingClerkActionId: "removing" },
      { clerkUserId: "another-user", status: "active" as const },
    ]) {
      const { t, employee, profileId } = await fixture()
      await t.run((ctx) => ctx.db.patch("employeeProfiles", profileId, patch))
      expect(await employee.action(api.betaClerk.connectAccount, {})).toEqual(
        []
      )
    }
    expect(
      clerk.organizations.createOrganizationMembership
    ).not.toHaveBeenCalled()
  })
  test("compensates membership creation when profile changes during Clerk request", async () => {
    const { t, employee, profileId } = await fixture()
    clerk.organizations.createOrganizationMembership.mockImplementationOnce(
      async () => {
        await t.run((ctx) =>
          ctx.db.patch("employeeProfiles", profileId, {
            normalizedEmail: "replacement@example.com",
          })
        )
      }
    )
    await expect(
      employee.action(api.betaClerk.connectAccount, {})
    ).rejects.toThrow("employeeNotFound")
    expect(
      clerk.organizations.deleteOrganizationMembership
    ).toHaveBeenCalledWith({ organizationId: "org-a", userId: "employee" })
  })
  test("repeated sign-in preserves profile, assignments and role", async () => {
    const { t, employee, profileId } = await fixture()
    await employee.action(api.betaClerk.connectAccount, {})
    const before = await t.run((ctx) =>
      ctx.db.get("employeeProfiles", profileId)
    )
    clerk.organizations.getOrganizationMembershipList.mockResolvedValue({
      data: [{ id: "membership" }],
    })
    await employee.action(api.betaClerk.connectAccount, {})
    expect(
      await t.run((ctx) => ctx.db.get("employeeProfiles", profileId))
    ).toEqual(before)
    expect(
      clerk.organizations.createOrganizationMembership
    ).toHaveBeenCalledTimes(1)
  })
  test("lifting beta restores ordinary creation and stored roles on the same account", async () => {
    const { t, employee, profileId } = await fixture()
    await employee.action(api.betaClerk.connectAccount, {})
    await t.run((ctx) =>
      ctx.db.patch("employeeProfiles", profileId, { accessLevel: "manager" })
    )
    expect(
      await employee.query(api.hubs.getManagerAccess, {
        organizationHint: "org-a",
      })
    ).toBe(null)
    await t.run(async (ctx) => {
      const policy = await ctx.db.query("betaPolicy").unique()
      await ctx.db.patch("betaPolicy", policy!._id, { enabled: false })
    })
    await t.action(internal.betaClerk.sync, {})
    expect(clerk.instance.updateRestrictions).toHaveBeenCalledWith({
      allowlist: false,
    })
    expect(clerk.users.updateUser).toHaveBeenCalledWith("employee", {
      createOrganizationEnabled: true,
    })
    expect(await employee.query(api.betaAccess.getMyAccess, {})).toEqual({
      canCreateOrganization: true,
    })
    expect(
      await employee.query(api.hubs.getManagerAccess, {
        organizationHint: "org-a",
      })
    ).toBe("manager")
    expect(
      await t.run((ctx) => ctx.db.get("employeeProfiles", profileId))
    ).toMatchObject({
      clerkUserId: "employee",
      status: "active",
      accessLevel: "manager",
    })
    await expect(
      t
        .withIdentity({
          ...employeeIdentity,
          org_id: "org-new",
          org_role: "org:admin",
        })
        .mutation(api.hubs.create, { ...hubArgs, slug: "new" })
    ).resolves.toMatchObject({ created: true })
  })
  test("Clerk signup list contains exact approved and employee emails, never whole domains", async () => {
    const { t } = await fixture()
    clerk.allowlistIdentifiers.getAllowlistIdentifierList.mockResolvedValue({
      data: [{ id: "old", identifier: "example.com" }],
      totalCount: 1,
    })
    await t.action(internal.betaClerk.sync, {})
    expect(
      clerk.allowlistIdentifiers.createAllowlistIdentifier.mock.calls
    ).toEqual([
      [{ identifier: "owner@example.com", notify: false }],
      [{ identifier: "employee@example.com", notify: false }],
    ])
    expect(
      clerk.allowlistIdentifiers.deleteAllowlistIdentifier
    ).toHaveBeenCalledWith("old")
    expect(clerk.instance.updateRestrictions).toHaveBeenCalledWith({
      allowlist: true,
    })
    expect(clerk.users.updateUser).not.toHaveBeenCalled()
  })
  test("only verified approved emails enable creation, even for pre-existing users", async () => {
    const { t, owner } = await fixture()
    clerk.users.getUser.mockResolvedValue({
      ...mockUser(),
      id: "owner",
      emailAddresses: [
        {
          emailAddress: "Owner@example.com",
          verification: { status: "verified" },
        },
      ],
    })
    await t.action(internal.betaClerk.refreshUser, { clerkUserId: "owner" })
    expect(clerk.users.updateUser).toHaveBeenCalledWith("owner", {
      createOrganizationEnabled: true,
    })
    expect(await owner.query(api.betaAccess.getMyAccess, {})).toEqual({
      canCreateOrganization: true,
    })
  })
})

test("removing an approval immediately caps existing managers without rewriting their role", async () => {
  const { t, owner, hubId } = await fixture()
  expect(
    await owner.query(api.hubs.getOwnerAuthorization, {
      organizationHint: "org-a",
    })
  ).toMatchObject({ authorized: true })
  await t.run(async (ctx) => {
    const policy = await ctx.db.query("betaPolicy").unique()
    await ctx.db.patch("betaPolicy", policy!._id, { creatorEmails: [] })
  })
  expect(
    await owner.query(api.hubs.getOwnerAuthorization, {
      organizationHint: "org-a",
    })
  ).toEqual({ authorized: false })
  await expect(
    owner.mutation(api.employees.create, { hubId, displayName: "Blocked" })
  ).rejects.toThrow("workplaceOwnerAccessRequired")
})

test("deactivated employees disappear from signup eligibility", async () => {
  const { t, profileId } = await fixture()
  expect(
    (
      await t.query(internal.betaAccess.employeeEmails, {
        paginationOpts: { numItems: 100, cursor: null },
      })
    ).page
  ).toContain("employee@example.com")
  await t.run((ctx) =>
    ctx.db.patch("employeeProfiles", profileId, { status: "deactivated" })
  )
  expect(
    (
      await t.query(internal.betaAccess.employeeEmails, {
        paginationOpts: { numItems: 100, cursor: null },
      })
    ).page
  ).toEqual([])
})

test("signed-out callers cannot connect accounts or inspect creation privileges", async () => {
  const t = convexTest(schema, modules)
  await expect(t.action(api.betaClerk.connectAccount, {})).rejects.toThrow(
    "notAuthenticated"
  )
  await expect(t.query(api.betaAccess.getMyAccess, {})).rejects.toThrow(
    "notAuthenticated"
  )
  expect(clerk.users.getUser).not.toHaveBeenCalled()
})

test("only one Clerk reconciliation may run at a time", async () => {
  const { t } = await fixture()
  expect(await t.mutation(internal.betaAccess.beginSync, {})).toBe(true)
  expect(await t.mutation(internal.betaAccess.beginSync, {})).toBe(false)
  expect(
    await t.run((ctx) => ctx.db.query("betaPolicy").unique())
  ).toMatchObject({ syncAgain: true })
})

test("an existing active profile wins over a second profile matching another verified email", async () => {
  const { t, employee, profileId, hubId } = await fixture()
  await employee.action(api.betaClerk.connectAccount, {})
  await t.run(async (ctx) => {
    await ctx.db.insert("employeeProfiles", {
      hubId,
      displayName: "Duplicate",
      email: "second@example.com",
      normalizedEmail: "second@example.com",
      status: "unclaimed",
      accessLevel: "viewer",
      createdBy: "owner",
      createdAt: 1,
      updatedAt: 1,
      invitationStatus: "not-sent",
    })
  })
  clerk.users.getUser.mockResolvedValue({
    ...mockUser(),
    emailAddresses: [
      ...mockUser().emailAddresses,
      {
        emailAddress: "second@example.com",
        verification: { status: "verified" },
      },
    ],
  })
  clerk.organizations.getOrganizationMembershipList.mockResolvedValue({
    data: [{ id: "membership" }],
  })
  await expect(
    employee.action(api.betaClerk.connectAccount, {})
  ).resolves.toEqual([{ organizationId: "org-a", hubSlug: "test" }])
  expect(
    await t.run((ctx) => ctx.db.get("employeeProfiles", profileId))
  ).toMatchObject({ clerkUserId: "employee", status: "active" })
})
