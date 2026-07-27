import { v } from "convex/values"

import {
  defaultTodaySections,
  normalizeTodaySections,
} from "../lib/today-sections"
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
import { buildSnapshot } from "./lib/snapshot"
import { createNotification } from "./lib/notifications"

const accessModeValidator = v.union(
  v.literal("public"),
  v.literal("restricted")
)
const managerAccessValidator = v.union(
  v.literal("editor"),
  v.literal("manager"),
  v.literal("owner")
)
const todaySectionKeyValidator = v.union(
  v.literal("welcome"),
  v.literal("quick-links"),
  v.literal("happening-today"),
  v.literal("current-announcements"),
  v.literal("coming-next"),
  v.literal("useful-guides")
)

const defaultDescription =
  "Current updates, important times, and practical guides for each shift."

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

async function availableSlug(ctx: MutationCtx, requested: string) {
  const base = slugify(requested) || "operations-hub"
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

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    accessMode: accessModeValidator,
    joinCode: v.string(),
    privateToken: v.string(),
    timeZone: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const activeOrganization = getActiveOrganizationFromIdentity(identity)
    if (!activeOrganization) throw new Error("No active organization")
    if (activeOrganization.role !== "org:admin") throw new Error("Unauthorized")

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
      throw new Error("Hub name must be between 2 and 80 characters")
    }
    if (normalizeJoinCode(args.joinCode).length < 8) {
      throw new Error("Join code is too short")
    }
    if (args.privateToken.length < 32) {
      throw new Error("Private link credential is too short")
    }
    const slug = await availableSlug(ctx, args.slug)
    const now = Date.now()
    const hubId = await ctx.db.insert("hubs", {
      name,
      slug,
      description: defaultDescription,
      address: "",
      timeZone: validateTimeZone(args.timeZone),
      contactName: "shift lead",
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
    return { hubId, slug, created: true }
  },
})

function optional(value: string, max: number) {
  const clean = value.trim()
  if (clean.length > max) throw new Error("A hub detail is too long")
  return clean
}

function validateTimeZone(value: string) {
  const clean = value.trim()
  try {
    new Intl.DateTimeFormat("en", { timeZone: clean }).format()
  } catch {
    throw new Error("Choose a valid time zone")
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
    const { hub } = await requireHubPermission(ctx, args.hubId, "owner")
    const name = args.name.trim()
    if (name.length < 2 || name.length > 80)
      throw new Error("Hub name must be between 2 and 80 characters")
    const contactEmail = optional(args.contactEmail, 200)
    if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail))
      throw new Error("Enter a valid contact email")

    await ctx.db.patch("hubs", args.hubId, {
      name,
      description: optional(args.description, 500),
      address: optional(args.address, 500),
      timeZone: validateTimeZone(args.timeZone),
      contactName: optional(args.contactName, 100) || "shift lead",
      contactEmail,
      contactPhone: optional(args.contactPhone, 80),
      updatedAt: Date.now(),
    })
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "employees",
      kind: "workplace",
      title: "Workplace details updated",
      message: "The establishment information on the Today page has changed.",
      href: "/",
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
    const { hub } = await requireHubPermission(ctx, args.hubId, "editor")
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
    const { hub } = await requireHubPermission(ctx, args.hubId, "editor")
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
    return null
  },
})

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
    if (
      managed.permission !== "editor" &&
      managed.permission !== "manager" &&
      managed.permission !== "owner"
    ) {
      return { kind: "forbidden" as const }
    }
    return {
      kind: "ready" as const,
      managerAccess:
        managed.permission === "editor"
          ? ("editor" as const)
          : managed.permission === "manager"
            ? ("manager" as const)
            : ("owner" as const),
      ...(await buildSnapshot(ctx, managed.hub, {
        includeDrafts: true,
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
    return managed.permission === "editor" ||
      managed.permission === "manager" ||
      managed.permission === "owner"
      ? managed.permission
      : null
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
    return {
      kind: "ready" as const,
      ...(await buildSnapshot(ctx, hub, {
        includeDrafts: false,
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
  handler: async (ctx, args) => {
    const { hub } = await requireHubPermission(ctx, args.hubId, "owner")
    if (normalizeJoinCode(args.joinCode).length < 8) {
      throw new Error("Join code is too short")
    }
    if (args.privateToken.length < 32) {
      throw new Error("Private link credential is too short")
    }
    const credentialVersion = hub.credentialVersion + 1
    await ctx.db.patch("hubs", hub._id, {
      joinCodeHash: hashCredential(normalizeJoinCode(args.joinCode)),
      privateTokenHash: hashCredential(args.privateToken),
      credentialVersion,
      updatedAt: Date.now(),
    })
    return { credentialVersion }
  },
})

export const setAccessMode = mutation({
  args: {
    hubId: v.id("hubs"),
    accessMode: accessModeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { hub } = await requireHubPermission(ctx, args.hubId, "owner")
    await ctx.db.patch("hubs", hub._id, {
      accessMode: args.accessMode,
      updatedAt: Date.now(),
    })
    return null
  },
})
