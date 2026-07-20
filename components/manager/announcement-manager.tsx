"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  FilePenLine,
  Megaphone,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAnnouncementState, type Announcement } from "@/lib/operations"
import { richTextToPlainText } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

type Status = "All" | "Active" | "Upcoming" | "Expired" | "Draft"

export function AnnouncementManager() {
  const {
    announcements,
    hub,
    saveAnnouncement,
    deleteAnnouncement,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const visible = useMemo(
    () =>
      announcements
        .filter(
          (announcement) =>
            `${announcement.title} ${richTextToPlainText(announcement.content)}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (status === "All" ||
              getAnnouncementState(announcement, new Date(), hub?.timeZone) ===
                status)
        )
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.publishedAt.localeCompare(a.publishedAt)
        ),
    [announcements, hub?.timeZone, query, status]
  )

  return (
    <div className="space-y-8">
      <ManagerHeading
        title="Manage announcements"
        description="Maintain temporary notices, dates, priority, and pinned state."
        action={
          <Link href="/manager/announcements/new" className={buttonVariants()}>
            <Plus /> New announcement
          </Link>
        }
      />
      <div className="flex flex-col gap-4 border bg-background p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search announcements…"
            aria-label="Search announcements"
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label="Filter announcements by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Upcoming">Upcoming</SelectItem>
            <SelectItem value="Expired">Expired</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((announcement) => {
            const state = getAnnouncementState(
              announcement,
              new Date(),
              hub?.timeZone
            )
            return (
              <Card key={announcement.id} className="shadow-none">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                    <Megaphone className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <Badge
                        variant={state === "Draft" ? "outline" : "secondary"}
                      >
                        {state}
                      </Badge>
                      <Badge
                        variant={
                          announcement.priority === "Urgent"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {announcement.priority}
                      </Badge>
                      {announcement.pinned && (
                        <Badge variant="secondary">
                          <Pin /> Pinned
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {richTextToPlainText(announcement.content)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        saveAnnouncement({
                          ...announcement,
                          pinned: !announcement.pinned,
                        })
                        showFeedback(
                          announcement.pinned
                            ? "Announcement unpinned."
                            : "Announcement pinned."
                        )
                      }}
                    >
                      {announcement.pinned ? (
                        <>
                          <PinOff /> Unpin
                        </>
                      ) : (
                        <>
                          <Pin /> Pin
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        saveAnnouncement({
                          ...announcement,
                          published: !announcement.published,
                        })
                        showFeedback(
                          announcement.published
                            ? "Announcement unpublished."
                            : "Announcement published."
                        )
                      }}
                    >
                      {announcement.published ? "Unpublish" : "Publish"}
                    </Button>
                    <Link
                      href={`/manager/announcements/${announcement.id}/edit`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      <FilePenLine /> Edit
                    </Link>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(announcement)}
                      aria-label={`Delete ${announcement.title}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="No matching announcements"
          description="Clear the search or choose another status filter."
        />
      )}
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? "announcement"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteAnnouncement(deleteTarget.id)
            showFeedback("Announcement deleted.")
          }
        }}
      />
    </div>
  )
}
