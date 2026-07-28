import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { requireHubPermission, requireIdentity } from "./lib/access"

const NOTE_LIFETIME_MS = 24 * 60 * 60 * 1000
const MAX_NOTE_LENGTH = 500
const MAX_WORKER_NOTES = 100

const workerNoteValidator = v.object({
  id: v.id("workerNotes"),
  text: v.string(),
  pinned: v.boolean(),
})

async function getVisibleNotes(ctx: QueryCtx, hubId: Id<"hubs">, now: number) {
  const candidateLimit = MAX_WORKER_NOTES + 1
  const [pinnedNotes, activeNotes] = await Promise.all([
    ctx.db
      .query("workerNotes")
      .withIndex("by_hubId_and_pinned_and_expiresAt", (q) =>
        q.eq("hubId", hubId).eq("pinned", true)
      )
      .order("desc")
      .take(candidateLimit),
    ctx.db
      .query("workerNotes")
      .withIndex("by_hubId_and_pinned_and_expiresAt", (q) =>
        q.eq("hubId", hubId).eq("pinned", false).gte("expiresAt", now)
      )
      .order("desc")
      .take(candidateLimit),
  ])
  const candidates = [...pinnedNotes, ...activeNotes]
  const notes = candidates
    .sort(
      (a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime
    )
    .slice(0, MAX_WORKER_NOTES)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        a.createdAt - b.createdAt ||
        a._creationTime - b._creationTime
    )

  return {
    notes,
    count: Math.min(candidates.length, MAX_WORKER_NOTES),
  }
}

async function hasReachedNoteLimit(
  ctx: MutationCtx,
  hubId: Id<"hubs">,
  now: number
) {
  const pinnedNotes = await ctx.db
    .query("workerNotes")
    .withIndex("by_hubId_and_pinned_and_expiresAt", (q) =>
      q.eq("hubId", hubId).eq("pinned", true)
    )
    .take(MAX_WORKER_NOTES)
  if (pinnedNotes.length >= MAX_WORKER_NOTES) return true

  const remainingSlots = MAX_WORKER_NOTES - pinnedNotes.length
  const activeNotes = await ctx.db
    .query("workerNotes")
    .withIndex("by_hubId_and_pinned_and_expiresAt", (q) =>
      q.eq("hubId", hubId).eq("pinned", false).gte("expiresAt", now)
    )
    .take(remainingSlots)
  return activeNotes.length >= remainingSlots
}

export const list = query({
  args: {
    hubId: v.id("hubs"),
    now: v.number(),
  },
  returns: v.object({
    notes: v.array(workerNoteValidator),
    count: v.number(),
    limit: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    const result = await getVisibleNotes(ctx, args.hubId, args.now)

    return {
      notes: result.notes.map((note) => ({
        id: note._id,
        text: note.text,
        pinned: note.pinned,
      })),
      count: result.count,
      limit: MAX_WORKER_NOTES,
    }
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
    if (await hasReachedNoteLimit(ctx, args.hubId, createdAt)) {
      throw new Error("workerNoteLimitReached")
    }
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

export const updateText = mutation({
  args: {
    hubId: v.id("hubs"),
    noteId: v.id("workerNotes"),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    const note = await ctx.db.get("workerNotes", args.noteId)
    if (!note || note.hubId !== args.hubId) return null

    const text = args.text.trim()
    if (text.length > MAX_NOTE_LENGTH) throw new Error("workerNoteTooLong")
    if (!text) {
      await ctx.db.delete("workerNotes", note._id)
      return null
    }

    await ctx.db.patch("workerNotes", note._id, { text })
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
