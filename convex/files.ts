import { v } from "convex/values"

import { mutation } from "./_generated/server"
import { requireOwnedHub } from "./lib/access"

export const generateUploadUrl = mutation({
  args: { hubId: v.id("hubs") },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
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
    await requireOwnedHub(ctx, args.hubId)
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
    return attachmentId
  },
})

export const remove = mutation({
  args: { hubId: v.id("hubs"), attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    const attachment = await ctx.db.get("attachments", args.attachmentId)
    if (!attachment || attachment.hubId !== args.hubId)
      throw new Error("Attachment not found")
    await ctx.storage.delete(attachment.storageId)
    await ctx.db.delete("attachments", attachment._id)
    return null
  },
})

export const discardUpload = mutation({
  args: { hubId: v.id("hubs"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireOwnedHub(ctx, args.hubId)
    await ctx.storage.delete(args.storageId)
    return null
  },
})
