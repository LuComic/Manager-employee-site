import { sha256 } from "@noble/hashes/sha2.js"
import { bytesToHex } from "@noble/hashes/utils.js"

import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

type ReadCtx = QueryCtx | MutationCtx

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
  return await ctx.db
    .query("hubs")
    .withIndex("by_ownerTokenIdentifier", (q) =>
      q.eq("ownerTokenIdentifier", identity.tokenIdentifier)
    )
    .unique()
}

export async function requireIdentity(ctx: ReadCtx) {
  const identity = await getIdentity(ctx)
  if (!identity) throw new Error("Not authenticated")
  return identity
}

export async function requireOwnedHub(ctx: ReadCtx, hubId: Id<"hubs">) {
  const identity = await requireIdentity(ctx)
  const hub = await ctx.db.get("hubs", hubId)
  if (!hub || hub.ownerTokenIdentifier !== identity.tokenIdentifier) {
    throw new Error("Unauthorized")
  }
  return hub
}

export async function isHubOwner(ctx: ReadCtx, hub: Doc<"hubs">) {
  const identity = await getIdentity(ctx)
  return identity?.tokenIdentifier === hub.ownerTokenIdentifier
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
