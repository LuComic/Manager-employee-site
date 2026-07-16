"use client"

import { useState } from "react"
import { Megaphone } from "lucide-react"

import { AnnouncementCard } from "@/components/operations/announcement-card"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import { getAnnouncementState } from "@/lib/operations"

type Filter = "Active" | "Upcoming" | "Expired"

export function AnnouncementsPage() {
  const { announcements } = useOperations()
  const [filter, setFilter] = useState<Filter>("Active")
  const visible = announcements
    .filter((announcement) => getAnnouncementState(announcement) === filter)
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        b.publishedAt.localeCompare(a.publishedAt)
    )

  return (
    <div className="space-y-8">
      <PageHeading
        title="Announcements"
        description="Temporary operational updates, changes, and notices for the whole establishment."
      />
      <div
        className="flex flex-wrap gap-2 border-b pb-4"
        aria-label="Announcement status"
      >
        {(["Active", "Upcoming", "Expired"] as const).map((item) => {
          const count = announcements.filter(
            (announcement) => getAnnouncementState(announcement) === item
          ).length
          return (
            <Button
              key={item}
              variant={filter === item ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
            >
              {item} ({count})
            </Button>
          )
        })}
      </div>
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          title={`No ${filter.toLowerCase()} announcements`}
          description={
            filter === "Active"
              ? "There are no current operational updates."
              : `There are no ${filter.toLowerCase()} announcements to show.`
          }
        />
      )}
    </div>
  )
}
