import { v } from "convex/values"

import {
  isBannerImageContentType,
  MAX_BANNER_IMAGE_SIZE_BYTES,
} from "../lib/banner-image"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server"
import {
  requireHubEditingPermission,
  requireHubPermission,
  requireIdentity,
} from "./lib/access"
import {
  bindHubStorage,
  deleteReferencedHubStorage,
  discardPendingHubStorage,
  registerHubStorage,
  requirePendingHubStorage,
} from "./lib/hubStorage"
import { createNotification } from "./lib/notifications"

const UPLOAD_INTENT_LIFETIME_MS = 15 * 60 * 1_000
const PENDING_UPLOAD_LIFETIME_MS = 60 * 60 * 1_000
const uploadSection = v.optional(
  v.union(v.literal("events"), v.literal("documents"))
)

async function requireUploadPermission(
  ctx: MutationCtx,
  hubId: Id<"hubs">,
  section: "events" | "documents" | undefined
) {
  if (section) {
    await requireHubEditingPermission(ctx, hubId, section)
  } else {
    await requireHubPermission(ctx, hubId, "editor")
  }
}

function validateUploadMetadata(args: { sha256: string; size: number }) {
  const sha256 = args.sha256.trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("invalidFileChecksum")
  }
  if (!Number.isSafeInteger(args.size) || args.size < 0) {
    throw new Error("invalidFileSize")
  }
  return { sha256, size: args.size }
}

function sha256Matches(stored: string, expectedHex: string) {
  if (stored === expectedHex) return true
  // convex-test reports storage hashes as base64; deployed Convex uses hex.
  const bytes = new Uint8Array(
    expectedHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []
  )
  return stored === btoa(String.fromCharCode(...bytes))
}

async function requireOwnedUploadIntent(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    uploadIntentId: Id<"uploadIntents">
    requestedBy: string
  }
) {
  const intent = await ctx.db.get("uploadIntents", args.uploadIntentId)
  if (
    !intent ||
    intent.hubId !== args.hubId ||
    intent.requestedBy !== args.requestedBy
  ) {
    throw new Error("uploadRequestNotFound")
  }
  if (Date.now() - intent.createdAt > UPLOAD_INTENT_LIFETIME_MS) {
    throw new Error("uploadRequestExpired")
  }
  return intent
}

export const generateUploadUrl = mutation({
  args: {
    hubId: v.id("hubs"),
    sha256: v.string(),
    size: v.number(),
    section: uploadSection,
  },
  returns: v.object({
    uploadUrl: v.string(),
    uploadIntentId: v.id("uploadIntents"),
  }),
  handler: async (ctx, args) => {
    await requireUploadPermission(ctx, args.hubId, args.section)
    const identity = await requireIdentity(ctx)
    const metadata = validateUploadMetadata(args)
    const uploadIntentId = await ctx.db.insert("uploadIntents", {
      hubId: args.hubId,
      requestedBy: identity.tokenIdentifier,
      ...metadata,
      createdAt: Date.now(),
    })
    await ctx.scheduler.runAfter(
      UPLOAD_INTENT_LIFETIME_MS,
      internal.files.expireUploadIntent,
      { uploadIntentId }
    )
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
      uploadIntentId,
    }
  },
})

export const registerUpload = mutation({
  args: {
    hubId: v.id("hubs"),
    uploadIntentId: v.id("uploadIntents"),
    storageId: v.id("_storage"),
    section: uploadSection,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUploadPermission(ctx, args.hubId, args.section)
    const identity = await requireIdentity(ctx)
    const intent = await requireOwnedUploadIntent(ctx, {
      hubId: args.hubId,
      uploadIntentId: args.uploadIntentId,
      requestedBy: identity.tokenIdentifier,
    })
    const stored = await ctx.db.system.get("_storage", args.storageId)
    if (!stored) throw new Error("uploadedFileNotFound")
    if (
      stored._creationTime < intent.createdAt ||
      !sha256Matches(stored.sha256, intent.sha256) ||
      stored.size !== intent.size
    ) {
      throw new Error("uploadedFileNotMatchUploadRequest")
    }
    const registeredId = await registerHubStorage(ctx, {
      hubId: args.hubId,
      storageId: args.storageId,
      uploadedBy: identity.tokenIdentifier,
    })
    await ctx.db.delete("uploadIntents", intent._id)
    await ctx.scheduler.runAfter(
      PENDING_UPLOAD_LIFETIME_MS,
      internal.files.expirePendingUpload,
      { hubStorageId: registeredId }
    )
    return null
  },
})

export const cancelUploadIntent = mutation({
  args: {
    hubId: v.id("hubs"),
    uploadIntentId: v.id("uploadIntents"),
    section: uploadSection,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUploadPermission(ctx, args.hubId, args.section)
    const identity = await requireIdentity(ctx)
    const intent = await ctx.db.get("uploadIntents", args.uploadIntentId)
    if (
      intent &&
      intent.hubId === args.hubId &&
      intent.requestedBy === identity.tokenIdentifier
    ) {
      await ctx.db.delete("uploadIntents", intent._id)
    }
    return null
  },
})

export const expireUploadIntent = internalMutation({
  args: { uploadIntentId: v.id("uploadIntents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get("uploadIntents", args.uploadIntentId)
    if (intent) await ctx.db.delete("uploadIntents", intent._id)
    return null
  },
})

export const expirePendingUpload = internalMutation({
  args: { hubStorageId: v.id("hubStorage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const record = await ctx.db.get("hubStorage", args.hubStorageId)
    if (!record || record.binding) return null
    const stored = await ctx.db.system.get("_storage", record.storageId)
    if (stored) await ctx.storage.delete(record.storageId)
    await ctx.db.delete("hubStorage", record._id)
    return null
  },
})

export const attachToEvent = mutation({
  args: {
    hubId: v.id("hubs"),
    eventSlug: v.string(),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    notifyEmployees: v.optional(v.boolean()),
  },
  returns: v.id("attachments"),
  handler: async (ctx, args) => {
    await requireHubEditingPermission(ctx, args.hubId, "events")
    const event = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.eventSlug)
      )
      .unique()
    if (!event) throw new Error("eventNotFound")
    const { stored } = await requirePendingHubStorage(
      ctx,
      args.hubId,
      args.storageId
    )
    const attachmentId = await ctx.db.insert("attachments", {
      hubId: args.hubId,
      eventId: event._id,
      storageId: args.storageId,
      name: args.name.trim().slice(0, 240) || "Attachment",
      contentType:
        (stored.contentType ?? args.contentType).trim().slice(0, 200) ||
        "application/octet-stream",
      size: stored.size,
      createdAt: Date.now(),
    })
    await bindHubStorage(ctx, args.hubId, args.storageId, {
      kind: "eventAttachment",
      attachmentId,
    })
    if (event.published && args.notifyEmployees !== false) {
      await createNotification(ctx, {
        hubId: args.hubId,
        audience: "employees",
        kind: "event",
        titleKey: "notificationEventAttachmentAdded",
        messageKey: "notificationEventHasNewAttachment",
        messageValues: { title: event.title },
        href: `/calendar/${event.slug}`,
      })
    }
    return attachmentId
  },
})

export const remove = mutation({
  args: {
    hubId: v.id("hubs"),
    attachmentId: v.id("attachments"),
    notifyEmployees: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubEditingPermission(ctx, args.hubId, "events")
    const attachment = await ctx.db.get("attachments", args.attachmentId)
    if (!attachment || attachment.hubId !== args.hubId) {
      throw new Error("attachmentNotFound")
    }
    const event = await ctx.db.get("events", attachment.eventId)
    await deleteReferencedHubStorage(ctx, {
      hubId: args.hubId,
      storageId: attachment.storageId,
      binding: {
        kind: "eventAttachment",
        attachmentId: attachment._id,
      },
      allowUntracked: true,
    })
    await ctx.db.delete("attachments", attachment._id)
    if (event?.published && args.notifyEmployees !== false) {
      await createNotification(ctx, {
        hubId: args.hubId,
        audience: "employees",
        kind: "event",
        titleKey: "notificationEventAttachmentRemoved",
        messageKey: "notificationEventAttachmentsUpdated",
        messageValues: { title: event.title },
        href: `/calendar/${event.slug}`,
      })
    }
    return null
  },
})

export const discardUpload = mutation({
  args: {
    hubId: v.id("hubs"),
    storageId: v.id("_storage"),
    section: uploadSection,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUploadPermission(ctx, args.hubId, args.section)
    const identity = await requireIdentity(ctx)
    await discardPendingHubStorage(ctx, {
      hubId: args.hubId,
      storageId: args.storageId,
      uploadedBy: identity.tokenIdentifier,
    })
    return null
  },
})

export const attachToHubBanner = mutation({
  args: {
    hubId: v.id("hubs"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { hub } = await requireHubPermission(ctx, args.hubId, "owner")
    const { stored } = await requirePendingHubStorage(
      ctx,
      args.hubId,
      args.storageId
    )
    const contentType = stored.contentType ?? ""
    if (!isBannerImageContentType(contentType)) {
      throw new Error("usejpgpngWebpavifImage")
    }
    if (stored.size > MAX_BANNER_IMAGE_SIZE_BYTES) {
      throw new Error("bannerImageSizeLimit")
    }

    await ctx.db.patch("hubs", hub._id, {
      bannerStorageId: args.storageId,
      updatedAt: Date.now(),
    })
    await bindHubStorage(ctx, args.hubId, args.storageId, {
      kind: "hubBanner",
    })
    if (hub.bannerStorageId && hub.bannerStorageId !== args.storageId) {
      await deleteReferencedHubStorage(ctx, {
        hubId: args.hubId,
        storageId: hub.bannerStorageId,
        binding: { kind: "hubBanner" },
        allowUntracked: true,
      })
    }
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "employees",
      kind: "workplace",
      titleKey: "notificationWorkplaceBannerUpdated",
      messageKey: "notificationTodayImageChanged",
      href: "/",
    })
    return null
  },
})

export const removeHubBanner = mutation({
  args: { hubId: v.id("hubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { hub } = await requireHubPermission(ctx, args.hubId, "owner")
    if (!hub.bannerStorageId) return null
    await ctx.db.patch("hubs", hub._id, {
      bannerStorageId: undefined,
      updatedAt: Date.now(),
    })
    await deleteReferencedHubStorage(ctx, {
      hubId: args.hubId,
      storageId: hub.bannerStorageId,
      binding: { kind: "hubBanner" },
      allowUntracked: true,
    })
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "employees",
      kind: "workplace",
      titleKey: "notificationWorkplaceBannerUpdated",
      messageKey: "notificationTodayBannerReset",
      href: "/",
    })
    return null
  },
})
