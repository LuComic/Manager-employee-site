"use client"

import { useState } from "react"
import { Megaphone } from "lucide-react"

import { T, useI18n } from "@/components/providers/i18n-provider"
import { AnnouncementCard } from "@/components/operations/announcement-card"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import { getAnnouncementState } from "@/lib/operations"

type Filter = "Active" | "Upcoming" | "Expired"

export function AnnouncementsPage() {
  const { t } = useI18n()
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
        title="Announcements"
        description="Temporary operational updates, changes, and notices for the whole establishment."
      />
      <div className="border-b pb-4">
        <SegmentedControl aria-label="Announcement status">
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
                <T>{item}</T> ({count})
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
          title={t(`No ${filter.toLowerCase()} announcements`)}
          description={
            filter === "Active"
              ? "There are no current operational updates."
              : t(`There are no ${filter.toLowerCase()} announcements to show.`)
          }
        />
      )}
    </div>
  )
}
