"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  Files,
  Megaphone,
  type LucideIcon,
} from "lucide-react"
import { useConvexAuth, useMutation, useQuery } from "convex/react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"

const GUEST_DEVICE_KEY = "operations-hub:notification-device"
let cachedGuestDeviceId: string | undefined

const kindIcons: Record<
  "guide" | "event" | "announcement" | "document" | "question" | "workplace",
  LucideIcon
> = {
  guide: BookOpen,
  event: CalendarDays,
  announcement: Megaphone,
  document: Files,
  question: CircleHelp,
  workplace: Building2,
}

function useGuestDeviceId(enabled: boolean) {
  const [guestDeviceId, setGuestDeviceId] = useState<string>()

  useEffect(() => {
    if (!enabled) return
    if (!cachedGuestDeviceId) {
      cachedGuestDeviceId =
        localStorage.getItem(GUEST_DEVICE_KEY) ?? crypto.randomUUID()
      localStorage.setItem(GUEST_DEVICE_KEY, cachedGuestDeviceId)
    }
    const timeout = window.setTimeout(
      () => setGuestDeviceId(cachedGuestDeviceId),
      0
    )
    return () => window.clearTimeout(timeout)
  }, [enabled])

  return guestDeviceId
}

function useNotificationFeed(manager: boolean) {
  const { hub, credential } = useOperations()
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const guestDeviceId = useGuestDeviceId(
    !manager && !authLoading && !isAuthenticated
  )
  const managerFeed = useQuery(
    api.notifications.listManager,
    manager && hub ? { hubId: hub.id } : "skip"
  )
  const employeeFeed = useQuery(
    api.notifications.listEmployee,
    !manager && hub && (isAuthenticated || guestDeviceId)
      ? {
          hubSlug: hub.slug,
          credential,
          guestDeviceId,
        }
      : "skip"
  )
  const markManagerRead = useMutation(api.notifications.markManagerRead)
  const markEmployeeRead = useMutation(api.notifications.markEmployeeRead)
  const markAllRead = useCallback(async () => {
    if (!hub) return
    if (manager) {
      await markManagerRead({ hubId: hub.id })
    } else if (isAuthenticated || guestDeviceId) {
      await markEmployeeRead({
        hubSlug: hub.slug,
        credential,
        guestDeviceId,
      })
    }
  }, [
    credential,
    guestDeviceId,
    hub,
    isAuthenticated,
    manager,
    markEmployeeRead,
    markManagerRead,
  ])

  return {
    feed: manager ? managerFeed : employeeFeed,
    markAllRead,
  }
}

export function NotificationButton({
  manager = false,
  className,
}: {
  manager?: boolean
  className?: string
}) {
  const t = useAppTranslations()
  const { feed } = useNotificationFeed(manager)
  const unreadCount = feed?.unreadCount ?? 0
  const href = manager ? "/manager/notifications" : "/notifications"

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        "relative",
        className
      )}
      aria-label={
        unreadCount
          ? t("Notifications, {count} unread", { count: unreadCount })
          : t("Notifications")
      }
    >
      <Bell />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] leading-none font-semibold text-background">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  )
}

export function NotificationCenter({ manager = false }: { manager?: boolean }) {
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  const { feed, markAllRead } = useNotificationFeed(manager)
  const newestCreatedAt = feed?.notifications[0]?.createdAt ?? 0
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(languageTag, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: hub?.timeZone,
      }),
    [hub?.timeZone, languageTag]
  )

  useEffect(() => {
    if (!feed?.unreadCount || newestCreatedAt <= feed.lastReadAt) return
    void markAllRead().catch(() => undefined)
  }, [feed?.lastReadAt, feed?.unreadCount, markAllRead, newestCreatedAt])

  const heading = manager ? (
    <ManagerHeading
      title="Notifications"
      description="Employee questions, account activity, and other workplace updates."
    />
  ) : (
    <PageHeading
      title="Notifications"
      description="New guides, events, announcements, assignments, and workplace updates."
    />
  )

  return (
    <div className="space-y-6">
      {heading}
      {feed === undefined ? (
        <p className="text-sm text-muted-foreground" role="status">
          <T>Loading notifications…</T>
        </p>
      ) : feed.notifications.length ? (
        <div className="space-y-3">
          {feed.notifications.map((notification) => {
            const Icon = kindIcons[notification.kind]
            const wasUnread = notification.createdAt > feed.lastReadAt
            return (
              <Link
                key={notification.id}
                href={notification.href}
                className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <Card
                  size="sm"
                  className={cn(
                    "shadow-none transition-colors group-hover:bg-muted/40",
                    wasUnread && "border-primary/40 bg-primary/5"
                  )}
                >
                  <CardContent className="flex items-start gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{notification.title}</h2>
                        {wasUnread && (
                          <Badge variant="secondary">
                            <T>New</T>
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {dateTimeFormatter.format(notification.createdAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description={
            manager
              ? "Employee activity will appear here."
              : "New workplace updates will appear here."
          }
        />
      )}
    </div>
  )
}
