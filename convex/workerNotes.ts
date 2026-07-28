import { v } from "convex/values"

import { internal } from "./_generated/api"
import { internalMutation, mutation, query } from "./_generated/server"
import { requireHubPermission, requireIdentity } from "./lib/access"

const NOTE_LIFETIME_MS = 24 * 60 * 60 * 1000
const MAX_NOTE_LENGTH = 500
const MAX_VISIBLE_NOTES_PER_GROUP = 100

const workerNoteValidator = v.object({
  id: v.id("workerNotes"),
  text: v.string(),
  pinned: v.boolean(),
  createdAt: v.number(),
  expiresAt: v.number(),
})

export const list = query({
  args: {
    hubId: v.id("hubs"),
    now: v.number(),
  },
  returns: v.array(workerNoteValidator),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")

    const [pinnedNotes, activeNotes] = await Promise.all([
      ctx.db
        .query("workerNotes")
        .withIndex("by_hubId_and_pinned", (q) =>
          q.eq("hubId", args.hubId).eq("pinned", true)
        )
        .order("asc")
        .take(MAX_VISIBLE_NOTES_PER_GROUP),
      ctx.db
        .query("workerNotes")
        .withIndex("by_hubId_and_pinned_and_expiresAt", (q) =>
          q
            .eq("hubId", args.hubId)
            .eq("pinned", false)
            .gte("expiresAt", args.now)
        )
        .order("asc")
        .take(MAX_VISIBLE_NOTES_PER_GROUP),
    ])

    return [...pinnedNotes, ...activeNotes].map((note) => ({
      id: note._id,
      text: note.text,
      pinned: note.pinned,
      createdAt: note.createdAt,
      expiresAt: note.expiresAt,
    }))
  },
})

export const create = mutation({
  args: {
    hubId: v.id("hubs"),
    text: v.string(),
  },
  returns: v.id("workerNotes"),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    const identity = await requireIdentity(ctx)
    const text = args.text.trim()
    if (!text) throw new Error("workerNoteRequired")
    if (text.length > MAX_NOTE_LENGTH) throw new Error("workerNoteTooLong")

    const createdAt = Date.now()
    const expiresAt = createdAt + NOTE_LIFETIME_MS
    const noteId = await ctx.db.insert("workerNotes", {
      hubId: args.hubId,
      text,
      pinned: false,
      createdBy: identity.tokenIdentifier,
      createdAt,
      expiresAt,
    })
    await ctx.scheduler.runAt(expiresAt, internal.workerNotes.deleteIfExpired, {
      noteId,
    })
    return noteId
  },
})

export const togglePinned = mutation({
  args: {
    hubId: v.id("hubs"),
    noteId: v.id("workerNotes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    const note = await ctx.db.get("workerNotes", args.noteId)
    if (!note || note.hubId !== args.hubId) return null

    if (note.pinned && note.expiresAt <= Date.now()) {
      await ctx.db.delete("workerNotes", note._id)
      return null
    }

    await ctx.db.patch("workerNotes", note._id, {
      pinned: !note.pinned,
    })
    return null
  },
})

export const deleteIfExpired = internalMutation({
  args: {
    noteId: v.id("workerNotes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get("workerNotes", args.noteId)
    if (note && !note.pinned && note.expiresAt <= Date.now()) {
      await ctx.db.delete("workerNotes", note._id)
    }
    return null
  },
})
