import type { UserIdentity } from "convex/server"
import { v, type Infer } from "convex/values"

import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export const auditActionValidator = v.union(
  v.literal("created"),
  v.literal("edited"),
  v.literal("deleted"),
  v.literal("drafted")
)

export const auditEntityTypeValidator = v.union(
  v.literal("announcement"),
  v.literal("attachment"),
  v.literal("category"),
  v.literal("document"),
  v.literal("employee"),
  v.literal("event"),
  v.literal("faq"),
  v.literal("guide"),
  v.literal("helpRequest"),
  v.literal("workerNote"),
  v.literal("workplace")
)

export const auditLogDocumentValidator = v.object({
  hubId: v.id("hubs"),
  actorId: v.string(),
  // Transitional: early development rows stored only Clerk's subject.
  actorSubject: v.optional(v.string()),
  actorName: v.string(),
  action: auditActionValidator,
  entityType: auditEntityTypeValidator,
  entityId: v.optional(v.string()),
  entityTitle: v.string(),
  occurredAt: v.number(),
})

export const auditLogResultValidator = auditLogDocumentValidator.extend({
  _id: v.id("auditLogs"),
  _creationTime: v.number(),
})

export type AuditAction = Infer<typeof auditActionValidator>
export type AuditEntityType = Infer<typeof auditEntityTypeValidator>
export type AuditActor = {
  actorId: string
  actorSubject?: string
  actorName: string
}

export const anonymousAuditActor: AuditActor = {
  actorId: "anonymous",
  actorName: "Anonymous employee",
}

export function auditActorFromIdentity(
  identity: UserIdentity,
  profileName?: string
): AuditActor {
  return {
    actorId: identity.tokenIdentifier,
    actorSubject: identity.subject,
    actorName:
      profileName?.trim() ||
      identity.name?.trim() ||
      identity.email?.trim() ||
      "Unknown user",
  }
}

export async function createAuditLog(
  ctx: MutationCtx,
  actor: AuditActor,
  args: {
    hubId: Id<"hubs">
    action: AuditAction
    entityType: AuditEntityType
    entityId?: string
    entityTitle: string
  }
) {
  await ctx.db.insert("auditLogs", {
    hubId: args.hubId,
    ...actor,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    entityTitle: args.entityTitle.trim().slice(0, 300) || "Untitled",
    occurredAt: Date.now(),
  })
}
