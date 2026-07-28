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
import { requireHubPermission } from "./lib/access"

const TEMPORARY_NOTES_LIFETIME_MS = 24 * 60 * 60 * 1000
const MAX_NOTES_LENGTH = 10_000

function persistentLines(text: string) {
  return text
    .split("\n")
    .filter((line) => line.startsWith("!"))
    .join("\n")
}

function hasTemporaryLines(text: string) {
  return text.split("\n").some((line) => line.trim() && !line.startsWith("!"))
}

async function getHubNotes(ctx: QueryCtx | MutationCtx, hubId: Id<"hubs">) {
  return await ctx.db
    .query("workerNotes")
    .withIndex("by_hubId", (q) => q.eq("hubId", hubId))
    .unique()
}

export const get = query({
  args: {
    hubId: v.id("hubs"),
    now: v.number(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    const notes = await getHubNotes(ctx, args.hubId)
    if (!notes) return ""
    if (
      notes.temporaryExpiresAt !== undefined &&
      notes.temporaryExpiresAt <= args.now
    ) {
      return persistentLines(notes.text)
    }
    return notes.text
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
    if (!args.text.trim()) {
      if (notes) await ctx.db.delete("workerNotes", notes._id)
      return null
    }

    const temporaryExpiresAt = hasTemporaryLines(args.text)
      ? Date.now() + TEMPORARY_NOTES_LIFETIME_MS
      : null
    const value = {
      hubId: args.hubId,
      text: args.text,
      ...(temporaryExpiresAt === null ? {} : { temporaryExpiresAt }),
    }
    let noteId: Id<"workerNotes">
    if (notes) {
      await ctx.db.replace("workerNotes", notes._id, value)
      noteId = notes._id
    } else {
      noteId = await ctx.db.insert("workerNotes", value)
    }

    if (temporaryExpiresAt !== null) {
      await ctx.scheduler.runAt(
        temporaryExpiresAt,
        internal.workerNotes.clearTemporaryLines,
        { noteId, temporaryExpiresAt }
      )
    }
    return null
  },
})

export const clearTemporaryLines = internalMutation({
  args: {
    noteId: v.id("workerNotes"),
    temporaryExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notes = await ctx.db.get("workerNotes", args.noteId)
    if (
      !notes ||
      notes.temporaryExpiresAt !== args.temporaryExpiresAt ||
      notes.temporaryExpiresAt > Date.now()
    ) {
      return null
    }

    const text = persistentLines(notes.text)
    if (!text) {
      await ctx.db.delete("workerNotes", notes._id)
    } else {
      await ctx.db.replace("workerNotes", notes._id, {
        hubId: notes.hubId,
        text,
      })
    }
    return null
  },
})
