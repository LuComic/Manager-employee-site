import { v, type Infer } from "convex/values"

import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export const hubStorageBindingValidator = v.union(
  v.object({
    kind: v.literal("documentResource"),
    documentId: v.id("documents"),
  }),
  v.object({
    kind: v.literal("documentBanner"),
    documentId: v.id("documents"),
  }),
  v.object({
    kind: v.literal("eventAttachment"),
    attachmentId: v.id("attachments"),
  }),
  v.object({
    kind: v.literal("hubBanner"),
  })
)

export type HubStorageBinding = Infer<typeof hubStorageBindingValidator>

async function findHubStorage(ctx: MutationCtx, storageId: Id<"_storage">) {
  return await ctx.db
    .query("hubStorage")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique()
}

function bindingMatches(
  current: HubStorageBinding | undefined,
  expected: HubStorageBinding
) {
  if (!current || current.kind !== expected.kind) return false
  if (current.kind === "documentResource") {
    return (
      expected.kind === "documentResource" &&
      current.documentId === expected.documentId
    )
  }
  if (current.kind === "documentBanner") {
    return (
      expected.kind === "documentBanner" &&
      current.documentId === expected.documentId
    )
  }
  if (current.kind === "eventAttachment") {
    return (
      expected.kind === "eventAttachment" &&
      current.attachmentId === expected.attachmentId
    )
  }
  return expected.kind === "hubBanner"
}

export async function registerHubStorage(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    storageId: Id<"_storage">
    uploadedBy: string
  }
) {
  const existing = await findHubStorage(ctx, args.storageId)
  if (existing) {
    if (
      existing.hubId === args.hubId &&
      existing.uploadedBy === args.uploadedBy &&
      !existing.binding
    ) {
      return existing._id
    }
    throw new Error("fileIsAlreadyRegistered")
  }
  const id = await ctx.db.insert("hubStorage", {
    hubId: args.hubId,
    storageId: args.storageId,
    uploadedBy: args.uploadedBy,
    createdAt: Date.now(),
  })
  return id
}

export async function requirePendingHubStorage(
  ctx: MutationCtx,
  hubId: Id<"hubs">,
  storageId: Id<"_storage">
) {
  const record = await findHubStorage(ctx, storageId)
  if (!record || record.hubId !== hubId) {
    throw new Error("fileNotBelongWorkplace")
  }
  if (record.binding) throw new Error("fileIsAlreadyInUse")
  const stored = await ctx.db.system.get("_storage", storageId)
  if (!stored) throw new Error("uploadedFileNotFound")
  return { record, stored }
}

export async function bindHubStorage(
  ctx: MutationCtx,
  hubId: Id<"hubs">,
  storageId: Id<"_storage">,
  binding: HubStorageBinding
) {
  const { record } = await requirePendingHubStorage(ctx, hubId, storageId)
  await ctx.db.patch("hubStorage", record._id, { binding })
}

export async function requireBoundHubStorage(
  ctx: MutationCtx,
  hubId: Id<"hubs">,
  storageId: Id<"_storage">,
  binding: HubStorageBinding
) {
  const record = await findHubStorage(ctx, storageId)
  if (
    !record ||
    record.hubId !== hubId ||
    !bindingMatches(record.binding, binding)
  ) {
    throw new Error("fileAssociationIsInvalid")
  }
  const stored = await ctx.db.system.get("_storage", storageId)
  if (!stored) throw new Error("uploadedFileNotFound")
  return { record, stored }
}

export async function discardPendingHubStorage(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    storageId: Id<"_storage">
    uploadedBy: string
  }
) {
  const { record } = await requirePendingHubStorage(
    ctx,
    args.hubId,
    args.storageId
  )
  if (record.uploadedBy !== args.uploadedBy) {
    throw new Error("onlyUploaderDiscardFile")
  }
  await ctx.storage.delete(args.storageId)
  await ctx.db.delete("hubStorage", record._id)
}

export async function deleteReferencedHubStorage(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    storageId: Id<"_storage">
    binding: HubStorageBinding
    allowUntracked?: boolean
  }
) {
  const record = await findHubStorage(ctx, args.storageId)
  if (!record) {
    if (!args.allowUntracked) throw new Error("fileAssociationIsInvalid")
  } else {
    if (
      record.hubId !== args.hubId ||
      !bindingMatches(record.binding, args.binding)
    ) {
      throw new Error("fileAssociationIsInvalid")
    }
    await ctx.db.delete("hubStorage", record._id)
  }
  const stored = await ctx.db.system.get("_storage", args.storageId)
  if (stored) await ctx.storage.delete(args.storageId)
}
