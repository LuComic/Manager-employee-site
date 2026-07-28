import { v } from "convex/values"

import type { Id } from "./_generated/dataModel"
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { requireHubPermission } from "./lib/access"

const MAX_NOTES_LENGTH = 10_000
const MAX_LEGACY_NOTES = 101

async function getHubNotes(ctx: QueryCtx | MutationCtx, hubId: Id<"hubs">) {
  return await ctx.db
    .query("workerNotes")
    .withIndex("by_hubId_and_pinned_and_expiresAt", (q) => q.eq("hubId", hubId))
    .take(MAX_LEGACY_NOTES)
}

function visibleText(
  notes: Awaited<ReturnType<typeof getHubNotes>>,
  now: number
) {
  return notes
    .filter((note) => note.pinned || note.expiresAt > now)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || a._creationTime - b._creationTime
    )
    .map((note) => note.text)
    .join("\n")
}

export const get = query({
  args: {
    hubId: v.id("hubs"),
    now: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    return visibleText(await getHubNotes(ctx, args.hubId), args.now)
  },
})

export const save = mutation({
  args: {
    hubId: v.id("hubs"),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    if (args.text.length > MAX_NOTES_LENGTH) {
      throw new Error("workerNoteTooLong")
    }

    const notes = await getHubNotes(ctx, args.hubId)
    const [primaryNote, ...extraNotes] = notes
    for (const note of extraNotes) {
      await ctx.db.delete("workerNotes", note._id)
    }

    if (!args.text.trim()) {
      if (primaryNote) await ctx.db.delete("workerNotes", primaryNote._id)
      return null
    }

    if (primaryNote) {
      await ctx.db.patch("workerNotes", primaryNote._id, {
        text: args.text,
        pinned: true,
        expiresAt: Number.MAX_SAFE_INTEGER,
      })
    } else {
      await ctx.db.insert("workerNotes", {
        hubId: args.hubId,
        text: args.text,
        pinned: true,
        expiresAt: Number.MAX_SAFE_INTEGER,
      })
    }
    return null
  },
})

// Keep the legacy scheduled callback until all pre-textarea expiry jobs drain.
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
