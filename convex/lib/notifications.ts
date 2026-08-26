import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

type NotificationKind =
  | "guide"
  | "event"
  | "announcement"
  | "document"
  | "question"
  | "workplace"
  | "trade"

type NotificationDetails = {
  hubId: Id<"hubs">
  kind: NotificationKind
  titleKey: string
  message?: string
  messageKey?: string
  messageValues?: Record<string, string | number>
  href: string
}

type NotificationInput = NotificationDetails &
  (
    | {
        audience: "employees"
        employeeProfileId?: never
      }
    | {
        audience: "managers"
        employeeProfileId?: Id<"employeeProfiles">
      }
    | {
        audience: "trade-managers"
        employeeProfileId?: never
      }
    | {
        audience: "trade-employees"
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
  const identity = await ctx.auth.getUserIdentity()
  await ctx.db.insert("notifications", {
    ...notification,
    ...(identity
      ? { actorViewerKey: `identity:${identity.tokenIdentifier}` }
      : {}),
  })
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
    publishedTitleKey: string
    updatedTitleKey: string
    unpublishedTitleKey: string
  }
) {
  if (change.isPublished) {
    await createNotification(ctx, {
      hubId: change.hubId,
      audience: "employees",
      kind: change.kind,
      titleKey: change.wasPublished
        ? change.updatedTitleKey
        : change.publishedTitleKey,
      message: change.contentTitle,
      href: change.detailHref,
    })
  } else if (change.wasPublished) {
    await createNotification(ctx, {
      hubId: change.hubId,
      audience: "employees",
      kind: change.kind,
      titleKey: change.unpublishedTitleKey,
      messageKey: "notificationContentNoLongerAvailable",
      messageValues: { title: change.contentTitle },
      href: change.listHref,
    })
  }
}
