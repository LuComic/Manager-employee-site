import { v } from "convex/values"

import {
  defaultTodaySections,
  normalizeTodaySections,
} from "../lib/today-sections"
import { RESERVATION_EVENT_TYPE_ID } from "../lib/categories"
import {
  normalizeWorkersCanEdit,
  workerEditableSections,
} from "../lib/worker-editing"
import type { Id } from "./_generated/dataModel"
import { mutation, query, type MutationCtx } from "./_generated/server"
import {
  canReadPublishedHub,
  getManagedHub,
  getHubPermission,
  hasHubAccess,
  hashCredential,
  normalizeJoinCode,
  getActiveOrganizationFromIdentity,
  requireIdentity,
  requireHubPermission,
} from "./lib/access"
import { auditActorFromIdentity, createAuditLog } from "./lib/auditLogs"
import {
  decryptHubCredentials,
  encryptHubCredentials,
} from "./lib/credentialEncryption"
import { buildSnapshot } from "./lib/snapshot"
import { createNotification } from "./lib/notifications"

const accessModeValidator = v.union(
  v.literal("public"),
  v.literal("restricted")
)
const managerAccessValidator = v.union(
  v.literal("viewer"),
  v.literal("editor"),
  v.literal("manager"),
  v.literal("owner")
)
const workerEditableSectionValidator = v.union(
  v.literal("guides"),
  v.literal("events"),
  v.literal("announcements"),
  v.literal("documents"),
  v.literal("faqs")
)
const hubCredentialsValidator = v.object({
  joinCode: v.string(),
  privateToken: v.string(),
  credentialVersion: v.number(),
})
const todaySectionKeyValidator = v.union(
  v.literal("welcome"),
  v.literal("quick-links"),
  v.literal("happening-today"),
  v.literal("current-announcements"),
  v.literal("coming-next"),
  v.literal("useful-guides")
)

const defaultHubCopy = {
  et: {
    description:
      "Praegused uuendused, olulised kellaajad ja praktilised juhendid igaks vahetuseks.",
    contactName: "vahetusvanem",
    reservationEventType: "Broneering",
  },
  en: {
    description:
      "Current updates, important times, and practical guides for each shift.",
    contactName: "shift lead",
    reservationEventType: "Reservation",
  },
} as const

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

async function availableSlug(ctx: MutationCtx, requested: string) {
  const base = slugify(requested) || "workhal"
  let candidate = base
  let suffix = 2
  while (
    await ctx.db
      .query("hubs")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique()
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

async function storeHubCredentials(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    joinCode: string
    privateToken: string
    credentialVersion: number
  }
) {
  const stored = await ctx.db
    .query("hubCredentials")
    .withIndex("by_hubId", (q) => q.eq("hubId", args.hubId))
    .unique()
  const credentials = {
    hubId: args.hubId,
    ...(await encryptHubCredentials({
      hubId: args.hubId,
      credentialVersion: args.credentialVersion,
      credentials: {
        joinCode: args.joinCode,
        privateToken: args.privateToken,
      },
    })),
    credentialVersion: args.credentialVersion,
  }
  if (stored) {
    await ctx.db.replace("hubCredentials", stored._id, credentials)
  } else {
    await ctx.db.insert("hubCredentials", credentials)
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    accessMode: accessModeValidator,
    joinCode: v.string(),
    privateToken: v.string(),
    timeZone: v.string(),
    locale: v.optional(v.union(v.literal("et"), v.literal("en"))),
  },
  returns: v.object({
    hubId: v.id("hubs"),
    slug: v.string(),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const activeOrganization = getActiveOrganizationFromIdentity(identity)
    if (!activeOrganization) throw new Error("noActiveOrganization")
    if (activeOrganization.role !== "org:admin") throw new Error("unauthorized")

    const mapped = await ctx.db
      .query("hubs")
      .withIndex("by_clerkOrganizationId", (q) =>
        q.eq("clerkOrganizationId", activeOrganization.organizationId)
      )
      .unique()
    if (mapped) {
      return {
        hubId: mapped._id,
        slug: mapped.slug,
        created: false,
      }
    }

    const name = args.name.trim()
    if (name.length < 2 || name.length > 80) {
      throw new Error("hubNameBetween280Characters")
    }
    if (normalizeJoinCode(args.joinCode).length < 8) {
      throw new Error("joinCodeIsTooShort")
    }
    if (args.privateToken.length < 32) {
      throw new Error("privateLinkCredentialIsTooShort")
    }
    const slug = await availableSlug(ctx, args.slug)
    const now = Date.now()
    const defaultCopy = defaultHubCopy[args.locale ?? "et"]
    const hubId = await ctx.db.insert("hubs", {
      name,
      slug,
      description: defaultCopy.description,
      address: "",
      timeZone: validateTimeZone(args.timeZone),
      contactName: defaultCopy.contactName,
      contactEmail: "",
      contactPhone: "",
      todaySections: defaultTodaySections.map((section) => ({ ...section })),
      clerkOrganizationId: activeOrganization.organizationId,
      accessMode: args.accessMode,
      joinCodeHash: hashCredential(normalizeJoinCode(args.joinCode)),
      privateTokenHash: hashCredential(args.privateToken),
      credentialVersion: 1,
      createdAt: now,
      updatedAt: now,
    })
    await storeHubCredentials(ctx, {
      hubId,
      joinCode: args.joinCode,
      privateToken: args.privateToken,
      credentialVersion: 1,
    })
    await ctx.db.insert("categories", {
      hubId,
      slug: RESERVATION_EVENT_TYPE_ID,
      label: defaultCopy.reservationEventType,
      iconKey: "general",
      description: "",
      order: 0,
      kind: "event",
    })
    await createAuditLog(ctx, auditActorFromIdentity(identity), {
      hubId,
      action: "created",
      entityType: "workplace",
      entityId: hubId,
      entityTitle: name,
    })
    return { hubId, slug, created: true }
  },
})

function optional(value: string, max: number) {
  const clean = value.trim()
  if (clean.length > max) throw new Error("aHubDetailIsTooLong")
  return clean
}

function validateTimeZone(value: string) {
  const clean = value.trim()
  try {
    new Intl.DateTimeFormat("en", { timeZone: clean }).format()
  } catch {
    throw new Error("chooseAValidTimeZone")
  }
  return clean
}

export const updateSettings = mutation({
  args: {
    hubId: v.id("hubs"),
    name: v.string(),
    description: v.string(),
    address: v.string(),
    timeZone: v.string(),
    contactName: v.string(),
    contactEmail: v.string(),
    contactPhone: v.string(),
  },
  handler: async (ctx, args) => {
    const { hub, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "owner"
    )
    const name = args.name.trim()
    if (name.length < 2 || name.length > 80)
      throw new Error("hubNameBetween280Characters")
    const contactEmail = optional(args.contactEmail, 200)
    if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail))
      throw new Error("enterAValidContactEmail")

    await ctx.db.patch("hubs", args.hubId, {
      name,
      description: optional(args.description, 500),
      address: optional(args.address, 500),
      timeZone: validateTimeZone(args.timeZone),
      contactName:
        optional(args.contactName, 100) || defaultHubCopy.et.contactName,
      contactEmail,
      contactPhone: optional(args.contactPhone, 80),
      updatedAt: Date.now(),
    })
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "employees",
      kind: "workplace",
      titleKey: "notificationWorkplaceDetailsUpdated",
      messageKey: "notificationTodayInformationChanged",
      href: "/",
    })
    await createAuditLog(ctx, auditActor, {
      hubId: hub._id,
      action: "edited",
      entityType: "workplace",
      entityId: hub._id,
      entityTitle: name,
    })
    return null
  },
})

export const moveTodaySection = mutation({
  args: {
    hubId: v.id("hubs"),
    key: todaySectionKeyValidator,
    direction: v.union(v.literal(-1), v.literal(1)),
  },
  handler: async (ctx, args) => {
    const { hub, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "editor"
    )
    const sections = normalizeTodaySections(hub.todaySections)
    const index = sections.findIndex((section) => section.key === args.key)
    const target = index + args.direction
    if (index < 0 || target < 0 || target >= sections.length) return null
    const current = sections[index]
    sections[index] = sections[target]
    sections[target] = current
    await ctx.db.patch("hubs", hub._id, {
      todaySections: sections,
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: hub._id,
      action: "edited",
      entityType: "workplace",
      entityId: hub._id,
      entityTitle: hub.name,
    })
    return null
  },
})

export const setTodaySectionVisibility = mutation({
  args: {
    hubId: v.id("hubs"),
    key: todaySectionKeyValidator,
    visible: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { hub, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "editor"
    )
    const todaySections = normalizeTodaySections(hub.todaySections).map(
      (section) =>
        section.key === args.key
          ? { ...section, visible: args.visible }
          : section
    )
    await ctx.db.patch("hubs", hub._id, {
      todaySections,
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: hub._id,
      action: "edited",
      entityType: "workplace",
      entityId: hub._id,
      entityTitle: hub.name,
    })
    return null
  },
})

export const setWorkersCanEdit = mutation({
  args: {
    hubId: v.id("hubs"),
    section: workerEditableSectionValidator,
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { hub, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "manager"
    )
    await ctx.db.patch("hubs", hub._id, {
      workersCanEdit: {
        ...normalizeWorkersCanEdit(hub.workersCanEdit),
        [args.section]: args.enabled,
      },
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: hub._id,
      action: "edited",
      entityType: "workplace",
      entityId: hub._id,
      entityTitle: hub.name,
    })
    return null
  },
})

function hasWorkerEditableSection(
  workersCanEdit: ReturnType<typeof normalizeWorkersCanEdit>
) {
  return workerEditableSections.some((section) => workersCanEdit[section])
}

export const getManagerSnapshot = query({
  args: {
    nowDate: v.string(),
    organizationHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.organizationHint) {
      const identity = await ctx.auth.getUserIdentity()
      if (
        getActiveOrganizationFromIdentity(identity)?.organizationId !==
        args.organizationHint
      ) {
        return { kind: "none" as const }
      }
    }
    const managed = await getManagedHub(ctx)
    if (!managed) return { kind: "none" as const }
    if (!managed.permission) {
      return { kind: "forbidden" as const }
    }
    const workersCanEdit = normalizeWorkersCanEdit(managed.hub.workersCanEdit)
    if (
      managed.permission === "viewer" &&
      !hasWorkerEditableSection(workersCanEdit)
    ) {
      return { kind: "forbidden" as const }
    }
    return {
      kind: "ready" as const,
      managerAccess: managed.permission,
      ...(await buildSnapshot(ctx, managed.hub, {
        includeDrafts: true,
        includePrivateEvents: true,
        ...(managed.permission === "viewer"
          ? { workerSections: workersCanEdit }
          : {}),
        includeOrganizationMapping: true,
        nowDate: args.nowDate,
      })),
    }
  },
})

export const getManagerAccess = query({
  args: { organizationHint: v.optional(v.string()) },
  returns: v.union(v.null(), managerAccessValidator),
  handler: async (ctx, args) => {
    const managed = await getManagedHub(ctx)
    if (
      !managed ||
      (args.organizationHint &&
        managed.hub.clerkOrganizationId !== args.organizationHint)
    ) {
      return null
    }
    if (!managed.permission) return null
    const workersCanEdit = normalizeWorkersCanEdit(managed.hub.workersCanEdit)
    if (
      managed.permission === "viewer" &&
      !hasWorkerEditableSection(workersCanEdit)
    ) {
      return null
    }
    return managed.permission
  },
})

export const getOwnerAuthorization = query({
  args: { organizationHint: v.string() },
  returns: v.union(
    v.object({ authorized: v.literal(false) }),
    v.object({
      authorized: v.literal(true),
      hubId: v.id("hubs"),
      organizationId: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const activeOrganization = getActiveOrganizationFromIdentity(identity)
    if (
      !activeOrganization ||
      activeOrganization.organizationId !== args.organizationHint
    ) {
      return { authorized: false as const }
    }
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_clerkOrganizationId", (q) =>
        q.eq("clerkOrganizationId", activeOrganization.organizationId)
      )
      .unique()
    if (!hub) return { authorized: false as const }
    const permission = await getHubPermission(ctx, hub)
    if (permission !== "owner") {
      return { authorized: false as const }
    }
    return {
      authorized: true as const,
      hubId: hub._id,
      organizationId: activeOrganization.organizationId,
    }
  },
})

export const getOwnerCredentials = query({
  args: { hubId: v.id("hubs") },
  returns: hubCredentialsValidator,
  handler: async (ctx, args) => {
    const { hub } = await requireHubPermission(ctx, args.hubId, "owner")
    const credentials = await ctx.db
      .query("hubCredentials")
      .withIndex("by_hubId", (q) => q.eq("hubId", hub._id))
      .unique()
    if (
      !credentials ||
      credentials.credentialVersion !== hub.credentialVersion
    ) {
      throw new Error("hubCredentialsUnavailable")
    }
    const decrypted = await decryptHubCredentials(credentials)
    return {
      ...decrypted,
      credentialVersion: credentials.credentialVersion,
    }
  },
})

export const getPublicSnapshot = query({
  args: {
    slug: v.string(),
    credential: v.optional(v.string()),
    nowDate: v.string(),
  },
  handler: async (ctx, args) => {
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()
    if (!hub) return { kind: "not-found" as const }
    if (!(await canReadPublishedHub(ctx, hub, args.credential))) {
      return {
        kind: "restricted" as const,
        hub: {
          id: hub._id,
          name: hub.name,
          slug: hub.slug,
          accessMode: hub.accessMode,
          credentialVersion: hub.credentialVersion,
        },
      }
    }
    const includePrivateEvents = await hasHubAccess(ctx, hub)
    return {
      kind: "ready" as const,
      ...(await buildSnapshot(ctx, hub, {
        includeDrafts: false,
        includePrivateEvents,
        includeOrganizationMapping: false,
        nowDate: args.nowDate,
      })),
    }
  },
})

export const getActiveMemberSnapshot = query({
  args: {
    nowDate: v.string(),
    organizationHint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    const activeOrganization = getActiveOrganizationFromIdentity(identity)
    if (!activeOrganization) return { kind: "none" as const }
    if (
      args.organizationHint &&
      args.organizationHint !== activeOrganization.organizationId
    ) {
      return { kind: "none" as const }
    }
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_clerkOrganizationId", (q) =>
        q.eq("clerkOrganizationId", activeOrganization.organizationId)
      )
      .unique()
    if (!hub) return { kind: "none" as const }
    if (!(await hasHubAccess(ctx, hub))) return { kind: "deactivated" as const }
    return {
      kind: "ready" as const,
      ...(await buildSnapshot(ctx, hub, {
        includeDrafts: false,
        includePrivateEvents: true,
        includeOrganizationMapping: false,
        nowDate: args.nowDate,
      })),
    }
  },
})

export const rotateCredentials = mutation({
  args: {
    hubId: v.id("hubs"),
    joinCode: v.string(),
    privateToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { hub, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "owner"
    )
    if (normalizeJoinCode(args.joinCode).length < 8) {
      throw new Error("joinCodeIsTooShort")
    }
    if (args.privateToken.length < 32) {
      throw new Error("privateLinkCredentialIsTooShort")
    }
    const credentialVersion = hub.credentialVersion + 1
    const updatedAt = Date.now()
    await ctx.db.patch("hubs", hub._id, {
      joinCodeHash: hashCredential(normalizeJoinCode(args.joinCode)),
      privateTokenHash: hashCredential(args.privateToken),
      credentialVersion,
      updatedAt,
    })
    await storeHubCredentials(ctx, {
      hubId: hub._id,
      joinCode: args.joinCode,
      privateToken: args.privateToken,
      credentialVersion,
    })
    await createAuditLog(ctx, auditActor, {
      hubId: hub._id,
      action: "edited",
      entityType: "workplace",
      entityId: hub._id,
      entityTitle: hub.name,
    })
    return null
  },
})

export const setAccessMode = mutation({
  args: {
    hubId: v.id("hubs"),
    accessMode: accessModeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { hub, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "owner"
    )
    await ctx.db.patch("hubs", hub._id, {
      accessMode: args.accessMode,
      updatedAt: Date.now(),
    })
    await createAuditLog(ctx, auditActor, {
      hubId: hub._id,
      action: "edited",
      entityType: "workplace",
      entityId: hub._id,
      entityTitle: hub.name,
    })
    return null
  },
})
