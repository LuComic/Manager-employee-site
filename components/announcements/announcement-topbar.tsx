"use client"

import { useEffect, useState } from "react"
import { ArrowRight } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { Link } from "@/i18n/navigation"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"
import {
  formatDate,
  getAnnouncementDaysUntilDue,
  getFeaturedAnnouncement,
} from "@/lib/operations"

export function AnnouncementTopbar() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { announcements, hub } = useOperations()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const announcement = getFeaturedAnnouncement(
    announcements,
    now,
    hub?.timeZone
  )
  if (!announcement) return null

  const dueDate = formatDate(
    announcement.expiresAt,
    { day: "numeric", month: "short" },
    hub?.timeZone,
    languageTag
  )
  const daysUntilDue = getAnnouncementDaysUntilDue(
    announcement,
    now,
    hub?.timeZone
  )
  const desktopLabel =
    daysUntilDue === 0
      ? t("announcementDueToday", { title: announcement.title })
      : daysUntilDue === 1
        ? t("announcementDueTomorrow", { title: announcement.title })
        : daysUntilDue === null
          ? t("announcementDueOnDate", {
              title: announcement.title,
              date: dueDate,
            })
          : t("announcementDueInDays", {
              title: announcement.title,
              count: daysUntilDue,
            })

  return (
    <Link
      href={`/announcements/${announcement.id}`}
      className="group flex min-h-9 items-center justify-center gap-2 bg-secondary-foreground px-4 py-2 text-center text-xs font-medium text-secondary transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6 sm:text-sm lg:px-8"
    >
      <span className="sm:hidden">
        {t("announcementDueMobile", { date: dueDate })}
      </span>
      <span className="hidden min-w-0 truncate sm:inline">{desktopLabel}</span>
      <ArrowRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
