import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"

import {
  normalizeWorkersCanEdit,
  type WorkerEditableSection,
} from "../../lib/worker-editing"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

type ReadCtx = QueryCtx | MutationCtx

export type OrganizationRole = "org:admin" | "org:member"
export type EmployeeAccessLevel = "viewer" | "editor" | "manager"
export type HubPermission = EmployeeAccessLevel | "owner"

const permissionRank: Record<HubPermission, number> = {
  viewer: 0,
  editor: 1,
  manager: 2,
  owner: 3,
}

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

export async function requireIdentity(ctx: ReadCtx) {
  const identity = await getIdentity(ctx)
  if (!identity) throw new Error("notAuthenticated")
  return identity
}

export async function getHubPermission(
  ctx: ReadCtx,
  hub: Doc<"hubs">
): Promise<HubPermission | null> {
  const identity = await getIdentity(ctx)
  if (!identity) return null

  const activeOrganization = getActiveOrganizationFromIdentity(identity)
  if (activeOrganization?.organizationId !== hub.clerkOrganizationId) {
    return null
  }

  const profiles = await ctx.db
    .query("employeeProfiles")
    .withIndex("by_hubId_and_clerkUserId", (q) =>
      q.eq("hubId", hub._id).eq("clerkUserId", identity.subject)
    )
    .take(10)
  const activeProfile = profiles.find((profile) => profile.status === "active")
  if (profiles.length > 0 && !activeProfile) return null
  if (activeOrganization.role === "org:admin") return "owner"
  if (activeProfile) return activeProfile.accessLevel ?? "viewer"
  return null
}

export async function requireHubPermission(
  ctx: ReadCtx,
  hubId: Id<"hubs">,
  minimum: HubPermission
) {
  const identity = await getIdentity(ctx)
  if (!identity) throw new Error("notAuthenticated")
  const hub = await ctx.db.get("hubs", hubId)
  if (!hub) throw new Error("unauthorized")
  const permission = await getHubPermission(ctx, hub)
  if (!permission) throw new Error("unauthorized")
  if (permissionRank[permission] < permissionRank[minimum]) {
    throw new Error(
      minimum === "owner"
        ? "workplaceOwnerAccessRequired"
        : minimum === "manager"
          ? "fullContentAccessRequired"
          : "editingAccessRequired"
    )
  }
  return { hub, permission }
}

export async function requireHubEditingPermission(
  ctx: ReadCtx,
  hubId: Id<"hubs">,
  section: WorkerEditableSection
) {
  const access = await requireHubPermission(ctx, hubId, "viewer")
  if (
    access.permission === "viewer" &&
    !normalizeWorkersCanEdit(access.hub.workersCanEdit)[section]
  ) {
    throw new Error("editingAccessRequired")
  }
  return access
}

export async function getManagedHub(ctx: ReadCtx) {
  const identity = await getIdentity(ctx)
  if (!identity) return null
  const activeOrganization = getActiveOrganizationFromIdentity(identity)
  if (!activeOrganization) return null
  const hub = await ctx.db
    .query("hubs")
    .withIndex("by_clerkOrganizationId", (q) =>
      q.eq("clerkOrganizationId", activeOrganization.organizationId)
    )
    .unique()
  if (!hub) return null
  const permission = await getHubPermission(ctx, hub)
  return { hub, permission }
}

export async function hasHubAccess(ctx: ReadCtx, hub: Doc<"hubs">) {
  return (await getHubPermission(ctx, hub)) !== null
}

export async function requireOrganizationHub(ctx: ReadCtx) {
  const identity = await requireIdentity(ctx)
  const activeOrganization = getActiveOrganizationFromIdentity(identity)
  if (!activeOrganization) throw new Error("noActiveOrganization")
  const hub = await ctx.db
    .query("hubs")
    .withIndex("by_clerkOrganizationId", (q) =>
      q.eq("clerkOrganizationId", activeOrganization.organizationId)
    )
    .unique()
  if (!hub) throw new Error("organizationNotConnectedHub")
  return { hub, identity, activeOrganization }
}

export async function canReadPublishedHub(
  ctx: ReadCtx,
  hub: Doc<"hubs">,
  credential?: string
) {
  if (await hasHubAccess(ctx, hub)) return true
  if (hub.accessMode === "public") return true
  if (!credential) return false

  const tokenHash = hashCredential(credential)
  const codeHash = hashCredential(normalizeJoinCode(credential))
  return tokenHash === hub.privateTokenHash || codeHash === hub.joinCodeHash
}
