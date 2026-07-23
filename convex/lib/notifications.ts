import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

type NotificationKind =
  "guide" | "event" | "announcement" | "document" | "question" | "workplace"

type NotificationDetails = {
  hubId: Id<"hubs">
  kind: NotificationKind
  title: string
  message: string
  href: string
}

type NotificationInput = NotificationDetails &
  (
    | {
        audience: "employees" | "managers"
        employeeProfileId?: never
      }
    | {
        audience: "employee"
        employeeProfileId: Id<"employeeProfiles">
      }
  )

export async function createNotification(
  ctx: MutationCtx,
  notification: NotificationInput
) {
  await ctx.db.insert("notifications", notification)
}

export async function notifyPublicationChange(
  ctx: MutationCtx,
  change: {
    hubId: Id<"hubs">
    kind: NotificationKind
    wasPublished: boolean
    isPublished: boolean
    contentTitle: string
    detailHref: string
    listHref: string
    publishedTitle: string
    updatedTitle: string
    unpublishedTitle: string
  }
) {
  if (change.isPublished) {
    await createNotification(ctx, {
      hubId: change.hubId,
      audience: "employees",
      kind: change.kind,
      title: change.wasPublished ? change.updatedTitle : change.publishedTitle,
      message: change.contentTitle,
      href: change.detailHref,
    })
  } else if (change.wasPublished) {
    await createNotification(ctx, {
      hubId: change.hubId,
      audience: "employees",
      kind: change.kind,
      title: change.unpublishedTitle,
      message: `${change.contentTitle} is no longer available.`,
      href: change.listHref,
    })
  }
}
