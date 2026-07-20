import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"

import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

type ReadCtx = QueryCtx | MutationCtx

export type OrganizationRole = "org:admin" | "org:member"

function stringClaim(value: unknown) {
  return typeof value === "string" ? value : undefined
}

export function getActiveOrganizationFromIdentity(
  identity: Awaited<ReturnType<typeof getIdentity>>
) {
  if (!identity) return null
  const nested =
    identity.o && typeof identity.o === "object" && !Array.isArray(identity.o)
      ? (identity.o as Record<string, unknown>)
      : undefined
  const organizationId =
    stringClaim(identity["o.id"]) ??
    stringClaim(nested?.id) ??
    stringClaim(identity.org_id) ??
    stringClaim(identity.orgId)
  const rawRole =
    stringClaim(identity["o.rol"]) ??
    stringClaim(nested?.rol) ??
    stringClaim(identity.org_role) ??
    stringClaim(identity.orgRole)
  if (!organizationId || !rawRole) return null
  const role = rawRole.startsWith("org:") ? rawRole : `org:${rawRole}`
  if (role !== "org:admin" && role !== "org:member") return null
  return { organizationId, role: role as OrganizationRole }
}

export function hashCredential(value: string) {
  return bytesToHex(sha256(new TextEncoder().encode(value)))
}

export function normalizeJoinCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export async function getIdentity(ctx: ReadCtx) {
  return await ctx.auth.getUserIdentity()
}

export async function getOwnedHub(ctx: ReadCtx) {
  const identity = await getIdentity(ctx)
  if (!identity) return null
  const activeOrganization = getActiveOrganizationFromIdentity(identity)
  if (activeOrganization) {
    const hub = await ctx.db
      .query("hubs")
      .withIndex("by_clerkOrganizationId", (q) =>
        q.eq("clerkOrganizationId", activeOrganization.organizationId)
      )
      .unique()
    if (hub && activeOrganization.role === "org:admin") return hub
    if (hub) return null
  }
  const legacy = await ctx.db
    .query("hubs")
    .withIndex("by_ownerTokenIdentifier", (q) =>
      q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
    )
    .unique()
  return legacy?.clerkOrganizationId ? null : legacy
}

export async function requireIdentity(ctx: ReadCtx) {
  const identity = await getIdentity(ctx)
  if (!identity) throw new Error("Not authenticated")
  return identity
}

export async function requireOwnedHub(ctx: ReadCtx, hubId: Id<"hubs">) {
  const identity = await requireIdentity(ctx)
  const hub = await ctx.db.get("hubs", hubId)
  if (!hub) throw new Error("Unauthorized")
  if (hub.clerkOrganizationId) {
    const activeOrganization = getActiveOrganizationFromIdentity(identity)
    if (
      activeOrganization?.organizationId !== hub.clerkOrganizationId ||
      activeOrganization.role !== "org:admin"
    ) {
      throw new Error("Unauthorized")
    }
    return hub
  }
  if (hub.ownerTokenIdentifier !== identity.tokenIdentifier) {
    throw new Error("Unauthorized")
  }
  return hub
}

export async function isHubOwner(ctx: ReadCtx, hub: Doc<"hubs">) {
  const identity = await getIdentity(ctx)
  if (!identity) return false
  if (hub.clerkOrganizationId) {
    const activeOrganization = getActiveOrganizationFromIdentity(identity)
    if (activeOrganization?.organizationId !== hub.clerkOrganizationId) {
      return false
    }
    if (activeOrganization.role === "org:admin") return true
    const profiles = await ctx.db
      .query("employeeProfiles")
      .withIndex("by_hubId_and_clerkUserId", (q) =>
        q.eq("hubId", hub._id).eq("clerkUserId", identity.subject)
      )
      .take(10)
    return (
      profiles.length === 0 ||
      profiles.some((profile) => profile.status === "active")
    )
  }
  return identity.tokenIdentifier === hub.ownerTokenIdentifier
}

export async function requireOrganizationHub(ctx: ReadCtx) {
  const identity = await requireIdentity(ctx)
  const activeOrganization = getActiveOrganizationFromIdentity(identity)
  if (!activeOrganization) throw new Error("No active organization")
  const hub = await ctx.db
    .query("hubs")
    .withIndex("by_clerkOrganizationId", (q) =>
      q.eq("clerkOrganizationId", activeOrganization.organizationId)
    )
    .unique()
  if (!hub) throw new Error("Organization is not connected to a hub")
  return { hub, identity, activeOrganization }
}

export async function canReadPublishedHub(
  ctx: ReadCtx,
  hub: Doc<"hubs">,
  credential?: string
) {
  if (hub.accessMode === "public" || (await isHubOwner(ctx, hub))) return true
  if (!credential) return false

  const tokenHash = hashCredential(credential)
  const codeHash = hashCredential(normalizeJoinCode(credential))
  return tokenHash === hub.privateTokenHash || codeHash === hub.joinCodeHash
}
