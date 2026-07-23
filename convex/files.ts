import { v } from "convex/values"

import {
  isBannerImageContentType,
  MAX_BANNER_IMAGE_SIZE_BYTES,
} from "../lib/banner-image"
import { mutation } from "./_generated/server"
import { requireHubPermission } from "./lib/access"
import { createNotification } from "./lib/notifications"

export const generateUploadUrl = mutation({
  args: { hubId: v.id("hubs") },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "editor")
    return await ctx.storage.generateUploadUrl()
  },
})

export const attachToEvent = mutation({
  args: {
    hubId: v.id("hubs"),
    eventSlug: v.string(),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "editor")
    const event = await ctx.db
      .query("events")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.eventSlug)
      )
      .unique()
    if (!event) throw new Error("Event not found")
    const stored = await ctx.db.system.get("_storage", args.storageId)
    if (!stored) throw new Error("Uploaded file not found")
    const attachmentId = await ctx.db.insert("attachments", {
      hubId: args.hubId,
      eventId: event._id,
      storageId: args.storageId,
      name: args.name.trim().slice(0, 240) || "Attachment",
      contentType: stored.contentType ?? args.contentType,
      size: stored.size,
      createdAt: Date.now(),
    })
    if (event.published) {
      await createNotification(ctx, {
        hubId: args.hubId,
        audience: "employees",
        kind: "event",
        title: "Event attachment added",
        message: `${event.title} has a new attachment.`,
        href: `/calendar/${event.slug}`,
      })
    }
    return attachmentId
  },
})

export const remove = mutation({
  args: { hubId: v.id("hubs"), attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "editor")
    const attachment = await ctx.db.get("attachments", args.attachmentId)
    if (!attachment || attachment.hubId !== args.hubId)
      throw new Error("Attachment not found")
    const event = await ctx.db.get("events", attachment.eventId)
    await ctx.storage.delete(attachment.storageId)
    await ctx.db.delete("attachments", attachment._id)
    if (event?.published) {
      await createNotification(ctx, {
        hubId: args.hubId,
        audience: "employees",
        kind: "event",
        title: "Event attachment removed",
        message: `${event.title} has updated attachments.`,
        href: `/calendar/${event.slug}`,
      })
    }
    return null
  },
})

export const discardUpload = mutation({
  args: { hubId: v.id("hubs"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "editor")
    await ctx.storage.delete(args.storageId)
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
    const stored = await ctx.db.system.get("_storage", args.storageId)
    if (!stored) throw new Error("Uploaded image not found")
    const contentType = stored.contentType ?? ""
    if (!isBannerImageContentType(contentType)) {
      throw new Error("Use a JPG, PNG, WebP, or AVIF image")
    }
    if (stored.size > MAX_BANNER_IMAGE_SIZE_BYTES) {
      throw new Error("Banner images must be 10 MB or smaller")
    }

    await ctx.db.patch("hubs", hub._id, {
      bannerStorageId: args.storageId,
      updatedAt: Date.now(),
    })
    if (hub.bannerStorageId && hub.bannerStorageId !== args.storageId) {
      await ctx.storage.delete(hub.bannerStorageId)
    }
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "employees",
      kind: "workplace",
      title: "Workplace banner updated",
      message: "The image on the Today page has been changed.",
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
    await ctx.storage.delete(hub.bannerStorageId)
    await createNotification(ctx, {
      hubId: hub._id,
      audience: "employees",
      kind: "workplace",
      title: "Workplace banner updated",
      message: "The Today page banner has been reset.",
      href: "/",
    })
    return null
  },
})
