/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import { describe, expect, test } from "vitest"

import { api } from "./_generated/api"
import schema from "./schema"
import { RESERVATION_EVENT_TYPE_ID } from "../lib/categories"

const modules = import.meta.glob("./**/*.ts")
const ownerIdentity = {
  subject: "owner-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|owner-a",
  name: "Ada Manager",
  o: { id: "org-a", rol: "admin", slg: "workplace-a" },
}
const editorIdentity = {
  subject: "editor-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|editor-a",
  name: "Eve Editor",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}
const inviteeIdentity = {
  subject: "invitee-a",
  issuer: "https://clerk.example.test",
  tokenIdentifier: "https://clerk.example.test|invitee-a",
  name: "Ivy Invitee",
  o: { id: "org-a", rol: "member", slg: "workplace-a" },
}

async function createHub(t: ReturnType<typeof convexTest>) {
  return await t.withIdentity(ownerIdentity).mutation(api.hubs.create, {
    name: "Test Hub",
    slug: "test-hub",
    accessMode: "public",
    joinCode: "ABCD-EFGH",
    privateToken: "private-token-that-is-at-least-thirty-two-characters",
    timeZone: "Europe/Tallinn",
  })
}

describe("activity logs", () => {
  test("records draft, edit, and deletion with the authenticated actor", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)

    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "rush-delivery",
      title: "Rush delivery",
      description: "A delivery that needs immediate attention",
      category: RESERVATION_EVENT_TYPE_ID,
      start: "2026-08-03T10:00",
      end: "2026-08-03T11:00",
      location: "Loading bay",
      notes: "",
      published: false,
      guideSlugs: [],
    })
    await owner.mutation(api.content.saveEvent, {
      hubId,
      slug: "rush-delivery",
      title: "Rush delivery updated",
      description: "A delivery that needs immediate attention",
      category: RESERVATION_EVENT_TYPE_ID,
      start: "2026-08-03T10:00",
      end: "2026-08-03T11:00",
      location: "Loading bay",
      notes: "",
      published: true,
      guideSlugs: [],
    })
    await owner.mutation(api.content.deleteEvent, {
      hubId,
      slug: "rush-delivery",
    })

    const logs = await owner.query(api.auditLogs.list, {
      hubId,
      paginationOpts: { cursor: null, numItems: 10 },
    })
    expect(logs.page.slice(0, 3)).toMatchObject([
      {
        actorId: ownerIdentity.tokenIdentifier,
        actorSubject: ownerIdentity.subject,
        actorName: "Ada Manager",
        action: "deleted",
        entityType: "event",
        entityTitle: "Rush delivery updated",
      },
      {
        actorName: "Ada Manager",
        action: "edited",
        entityType: "event",
        entityTitle: "Rush delivery updated",
      },
      {
        actorName: "Ada Manager",
        action: "drafted",
        entityType: "event",
        entityTitle: "Rush delivery",
      },
    ])
  })

  test("keeps the log visible only to managers", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    await t.run(async (ctx) => {
      const now = Date.now()
      await ctx.db.insert("employeeProfiles", {
        hubId,
        clerkUserId: editorIdentity.subject,
        displayName: editorIdentity.name,
        status: "active",
        accessLevel: "editor",
        createdBy: ownerIdentity.subject,
        createdAt: now,
        updatedAt: now,
        invitationStatus: "accepted",
      })
    })

    await expect(
      t.withIdentity(editorIdentity).query(api.auditLogs.list, {
        hubId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).rejects.toThrow("fullContentAccessRequired")
  })

  test("records invitations, membership changes, worker notes, and anonymous help", async () => {
    const t = convexTest(schema, modules)
    const { hubId } = await createHub(t)
    const owner = t.withIdentity(ownerIdentity)
    const profileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Eve Employee",
      email: "eve@example.test",
      accessLevel: "viewer",
    })

    await owner.mutation(api.employees.prepareInvitation, {
      profileId,
      correlationCredential: "invitation-credential-at-least-32-characters",
    })
    await owner.mutation(api.employees.recordInvitation, {
      profileId,
      invitationId: "invitation-a",
    })
    await owner.mutation(api.employees.recordInvitationFailure, {
      profileId,
      message: "Provider failure",
    })
    await owner.mutation(api.employees.markInvitationStatus, {
      profileId,
      status: "revoked",
    })

    const inviteeProfileId = await owner.mutation(api.employees.create, {
      hubId,
      displayName: "Ivy Invitee",
      email: "ivy@example.test",
      accessLevel: "viewer",
    })
    await owner.mutation(api.employees.prepareInvitation, {
      profileId: inviteeProfileId,
      correlationCredential: "second-invitation-credential-at-least-32-chars",
    })
    await t
      .withIdentity(inviteeIdentity)
      .mutation(api.employees.activateByInvitation, {
        correlationCredential: "second-invitation-credential-at-least-32-chars",
      })

    const activeProfileId = await t.run(async (ctx) => {
      const now = Date.now()
      return await ctx.db.insert("employeeProfiles", {
        hubId,
        clerkUserId: "member-to-reconcile",
        displayName: "Reconciled Member",
        status: "active",
        accessLevel: "viewer",
        createdBy: ownerIdentity.subject,
        createdAt: now,
        updatedAt: now,
        invitationStatus: "accepted",
      })
    })
    await owner.mutation(api.employees.reconcileMemberships, {
      hubId,
      activeClerkUserIds: [],
    })

    await owner.mutation(api.workerNotes.save, {
      hubId,
      text: "First note",
      expectedText: "",
    })
    await owner.mutation(api.workerNotes.save, {
      hubId,
      text: "!Persistent note",
      expectedText: "First note",
    })
    await owner.mutation(api.workerNotes.save, {
      hubId,
      text: "",
      expectedText: "!Persistent note",
    })
    await t.mutation(api.content.submitHelpRequest, {
      hubSlug: "test-hub",
      topic: "Need assistance",
      message: "Please help with this task.",
    })

    const logs = await owner.query(api.auditLogs.list, {
      hubId,
      paginationOpts: { cursor: null, numItems: 50 },
    })
    expect(
      logs.page.filter(
        (log) =>
          log.entityType === "employee" &&
          log.entityId === profileId &&
          log.action === "edited"
      )
    ).toHaveLength(4)
    expect(logs.page).toContainEqual(
      expect.objectContaining({
        actorId: inviteeIdentity.tokenIdentifier,
        actorSubject: inviteeIdentity.subject,
        action: "edited",
        entityType: "employee",
        entityId: inviteeProfileId,
      })
    )
    expect(logs.page).toContainEqual(
      expect.objectContaining({
        action: "edited",
        entityType: "employee",
        entityId: activeProfileId,
      })
    )
    expect(
      logs.page
        .filter((log) => log.entityType === "workerNote")
        .map((log) => log.action)
    ).toEqual(["deleted", "edited", "created"])
    expect(logs.page).toContainEqual(
      expect.objectContaining({
        actorId: "anonymous",
        action: "created",
        entityType: "helpRequest",
        entityTitle: "Need assistance",
      })
    )
  })
})
