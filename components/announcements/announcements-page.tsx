"use client"

import { useState } from "react"
import { Megaphone } from "lucide-react"

import { T } from "@/components/translated-text"
import { AnnouncementCard } from "@/components/operations/announcement-card"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { getAnnouncementState } from "@/lib/operations"

type Filter = "Active" | "Upcoming" | "Expired"

const filterLabelKeys = {
  Active: "active",
  Upcoming: "upcoming",
  Expired: "expired",
} satisfies Record<Filter, AppMessageKey>

export function AnnouncementsPage() {
  const t = useAppTranslations()
  const { announcements, hub } = useOperations()
  const [filter, setFilter] = useState<Filter>("Active")
  const visible = announcements
    .filter(
      (announcement) =>
        getAnnouncementState(announcement, new Date(), hub?.timeZone) === filter
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.publishedAt.localeCompare(a.publishedAt)
    )

  return (
    <div className="space-y-6">
      <PageHeading
        title="announcements"
        description="temporaryOperationalUpdatesChangesNoticesWholeEstablishment"
      />
      <div className="border-b pb-4">
        <SegmentedControl aria-label={t("announcementStatus")}>
          {(["Active", "Upcoming", "Expired"] as const).map((item) => {
            const count = announcements.filter(
              (announcement) =>
                getAnnouncementState(
                  announcement,
                  new Date(),
                  hub?.timeZone
                ) === item
            ).length
            return (
              <SegmentedControlItem
                key={item}
                selected={filter === item}
                size="sm"
                onClick={() => setFilter(item)}
              >
                <T>{filterLabelKeys[item]}</T> ({count})
              </SegmentedControlItem>
            )
          })}
        </SegmentedControl>
      </div>
      {visible.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title={
            filter === "Active"
              ? "noActiveAnnouncements"
              : filter === "Upcoming"
                ? "noUpcomingAnnouncements"
                : "noExpiredAnnouncements"
          }
          description={
            filter === "Active"
              ? "noCurrentOperationalUpdates"
              : filter === "Upcoming"
                ? "thereNoUpcomingAnnouncementsShow"
                : "thereNoExpiredAnnouncementsShow"
          }
        />
      )}
    </div>
  )
}
