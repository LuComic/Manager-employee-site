/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { expect, test } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"

const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "owner-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-a",
  o: { id: "org-a", rol: "admin", slg: "workplace-a" },
}
const employeeIdentity = {
  subject: "employee-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|employee-a",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}

test("employees acknowledge important announcements once and edits reset confirmations", async () => {
  const t = convexTest(schema, modules)
  const { hubId } = await t.run(async (ctx) => {
    const now = Date.now()
    const hubId = await ctx.db.insert("hubs", {
      name: "Test Hub",
      slug: "test-hub",
      clerkOrganizationId: "org-a",
      accessMode: "public",
      joinCodeHash: "join-code",
      privateTokenHash: "private-token",
      credentialVersion: 1,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert("employeeProfiles", {
      hubId,
      clerkUserId: employeeIdentity.subject,
      displayName: "Employee",
      status: "active",
      accessLevel: "viewer",
      createdBy: ownerIdentity.subject,
      createdAt: now,
      updatedAt: now,
      invitationStatus: "accepted",
    })
    return { hubId }
  })
  const owner = t.withIdentity(ownerIdentity)
  const employee = t.withIdentity(employeeIdentity)
  const content = {
    type: "doc" as const,
    content: [{ type: "paragraph", content: [{ type: "text", text: "Read" }] }],
  }

  await owner.mutation(api.content.saveAnnouncement, {
    hubId,
    slug: "important-update",
    title: "Important update",
    content,
    publishedAt: "2026-08-30",
    expiresAt: "2026-09-02",
    priority: "Important",
    pinned: false,
    published: true,
  })
  await employee.mutation(api.content.acknowledgeAnnouncement, {
    hubId,
    slug: "important-update",
  })
  await employee.mutation(api.content.acknowledgeAnnouncement, {
    hubId,
    slug: "important-update",
  })

  const employeeSnapshot = await employee.query(
    api.hubs.getActiveMemberSnapshot,
    { nowDate: "2026-08-30" }
  )
  expect(employeeSnapshot.kind).toBe("ready")
  if (employeeSnapshot.kind !== "ready") throw new Error("snapshot not ready")
  expect(employeeSnapshot.announcements[0].acknowledged).toBe(true)

  const managerSnapshot = await owner.query(api.hubs.getManagerSnapshot, {
    nowDate: "2026-08-30",
  })
  expect(managerSnapshot.kind).toBe("ready")
  if (managerSnapshot.kind !== "ready") throw new Error("snapshot not ready")
  expect(managerSnapshot.announcements[0]).toMatchObject({
    acknowledgedCount: 1,
    activeEmployeeCount: 1,
  })

  await owner.mutation(api.content.saveAnnouncement, {
    hubId,
    slug: "important-update",
    title: "Important update — revised",
    content,
    publishedAt: "2026-08-30",
    expiresAt: "2026-09-02",
    priority: "Important",
    pinned: false,
    published: true,
  })
  const revisedSnapshot = await owner.query(api.hubs.getManagerSnapshot, {
    nowDate: "2026-08-30",
  })
  if (revisedSnapshot.kind !== "ready") throw new Error("snapshot not ready")
  expect(revisedSnapshot.announcements[0].acknowledgedCount).toBe(0)
})
