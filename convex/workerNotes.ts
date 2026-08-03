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
import { hasHubAccess, requireHubPermission } from "./lib/access"
import { createAuditLog } from "./lib/auditLogs"

const TEMPORARY_NOTES_LIFETIME_MS = 24 * 60 * 60 * 1000
const MAX_NOTES_LENGTH = 10_000

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
    .unique()
}

export const canAccess = query({
  args: {
    hubId: v.id("hubs"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const hub = await ctx.db.get("hubs", args.hubId)
    return hub !== null && (await hasHubAccess(ctx, hub))
  },
})

function visibleText(
  notes: Awaited<ReturnType<typeof getHubNotes>>,
  now: number
) {
  if (!notes) return ""
  if (
    notes.temporaryExpiresAt !== undefined &&
    notes.temporaryExpiresAt <= now
  ) {
    return persistentLines(notes.text)
  }
  return notes.text
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
    const { hub, auditActor } = await requireHubPermission(
      ctx,
      args.hubId,
      "viewer"
    )
    if (args.text.length > MAX_NOTES_LENGTH) {
      throw new Error("workerNoteTooLong")
    }

    const notes = await getHubNotes(ctx, args.hubId)
    const currentText = visibleText(notes, Date.now())
    if (currentText !== args.expectedText) {
      return { status: "conflict", currentText } as const
    }

    if (!args.text.trim()) {
      if (notes) {
        await ctx.db.delete("workerNotes", notes._id)
        await createAuditLog(ctx, auditActor, {
          hubId: args.hubId,
          action: "deleted",
          entityType: "workerNote",
          entityId: notes._id,
          entityTitle: hub.name,
        })
      }
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
    await createAuditLog(ctx, auditActor, {
      hubId: args.hubId,
      action: notes ? "edited" : "created",
      entityType: "workerNote",
      entityId: noteId,
      entityTitle: hub.name,
    })
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
