import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"
import { requireIdentity } from "./access"

export type AuditAction = "created" | "edited" | "deleted" | "drafted"
export type AuditEntityType =
  | "announcement"
  | "attachment"
  | "category"
  | "document"
  | "employee"
  | "event"
  | "faq"
  | "guide"
  | "helpRequest"
  | "workplace"

export async function createAuditLog(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    action: AuditAction
    entityType: AuditEntityType
    entityId?: string
    entityTitle: string
  }
) {
  const identity = await requireIdentity(ctx)
  const profiles = await ctx.db
    .query("employeeProfiles")
    .withIndex("by_hubId_and_clerkUserId", (q) =>
      q.eq("hubId", args.hubId).eq("clerkUserId", identity.subject)
    )
    .take(10)
  const profile = profiles.find((candidate) => candidate.status === "active")
  const actorName =
    profile?.displayName || identity.name || identity.email || "Unknown user"

  await ctx.db.insert("auditLogs", {
    hubId: args.hubId,
    actorId: identity.subject,
    actorName,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    entityTitle: args.entityTitle.trim().slice(0, 300) || "Untitled",
    occurredAt: Date.now(),
  })
}
