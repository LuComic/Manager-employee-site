import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
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
const MAX_LEGACY_NOTES = 101

const saveResultValidator = v.union(
  v.object({ status: v.literal("saved") }),
  v.object({
    status: v.literal("conflict"),
    currentText: v.string(),
  })
)

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
    .take(MAX_LEGACY_NOTES)
}

function isLegacyNote(note: Doc<"workerNotes">) {
  return note.pinned !== undefined || note.expiresAt !== undefined
}

function legacyNoteText(note: Doc<"workerNotes">) {
  if (!note.pinned) return note.text
  return note.text
    .split("\n")
    .map((line) => (line.startsWith("!") ? line : `! ${line}`))
    .join("\n")
}

function visibleText(notes: Doc<"workerNotes">[], now: number) {
  const currentNote = notes.findLast((note) => !isLegacyNote(note))
  if (currentNote) {
    if (
      currentNote.temporaryExpiresAt !== undefined &&
      currentNote.temporaryExpiresAt <= now
    ) {
      return persistentLines(currentNote.text)
    }
    return currentNote.text
  }

  return notes
    .filter(
      (note) =>
        note.pinned === true ||
        (note.expiresAt !== undefined && note.expiresAt > now)
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) || a._creationTime - b._creationTime
    )
    .map(legacyNoteText)
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
    const notes = await getHubNotes(ctx, args.hubId)
    return visibleText(notes, args.now)
  },
})

export const save = mutation({
  args: {
    hubId: v.id("hubs"),
    text: v.string(),
    expectedText: v.string(),
  },
  returns: saveResultValidator,
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "viewer")
    if (args.text.length > MAX_NOTES_LENGTH) {
      throw new Error("workerNoteTooLong")
    }

    const notes = await getHubNotes(ctx, args.hubId)
    const currentText = visibleText(notes, Date.now())
    if (currentText !== args.expectedText) {
      return { status: "conflict", currentText } as const
    }

    const currentNote = notes.findLast((note) => !isLegacyNote(note))
    const primaryNote = currentNote ?? notes[0]
    const extraNotes = notes.filter((note) => note._id !== primaryNote?._id)
    for (const note of extraNotes) {
      await ctx.db.delete("workerNotes", note._id)
    }

    if (!args.text.trim()) {
      if (primaryNote) await ctx.db.delete("workerNotes", primaryNote._id)
      return { status: "saved" } as const
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
    if (primaryNote) {
      await ctx.db.replace("workerNotes", primaryNote._id, value)
      noteId = primaryNote._id
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
    return { status: "saved" } as const
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

// Keep the legacy scheduled callback until pre-textarea jobs have drained.
export const deleteIfExpired = internalMutation({
  args: {
    noteId: v.id("workerNotes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get("workerNotes", args.noteId)
    if (
      note?.pinned === false &&
      note.expiresAt !== undefined &&
      note.expiresAt <= Date.now()
    ) {
      await ctx.db.delete("workerNotes", note._id)
    }
    return null
  },
})
