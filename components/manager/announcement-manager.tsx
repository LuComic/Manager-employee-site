"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
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
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  announcementPriorityMessageKeys,
  announcementStateMessageKeys,
  getAnnouncementState,
  type Announcement,
} from "@/lib/operations"
import { richTextToPlainText } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

type Status = "All" | "Active" | "Upcoming" | "Expired" | "Draft"

export function AnnouncementManager() {
  const t = useAppTranslations()
  const {
    announcements,
    hub,
    canCreateContent,
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
    <div className="space-y-6">
      <ManagerHeading
        title="manageAnnouncements"
        description="maintainTemporaryNoticesDatesPriorityPinnedState"
        action={
          canCreateContent ? (
            <Link
              href="/manager/announcements/new"
              className={buttonVariants()}
            >
              <Plus /> <T>createAnnouncement</T>
            </Link>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 border bg-background p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchAnnouncementsPlaceholder")}
            aria-label={t("searchAnnouncements")}
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterAnnouncementsByStatus")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>all</T>
            </SelectItem>
            <SelectItem value="Active">
              <T>active</T>
            </SelectItem>
            <SelectItem value="Upcoming">
              <T>upcoming</T>
            </SelectItem>
            <SelectItem value="Expired">
              <T>expired</T>
            </SelectItem>
            <SelectItem value="Draft">
              <T>draft</T>
            </SelectItem>
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
              <ManagerListItem
                key={announcement.id}
                icon={<Megaphone className="size-5" />}
                title={announcement.title}
                metadata={[
                  <Badge
                    key="status"
                    variant={state === "Draft" ? "outline" : "secondary"}
                  >
                    {t(announcementStateMessageKeys[state])}
                  </Badge>,
                  <Badge
                    key="priority"
                    variant={
                      announcement.priority === "Urgent"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {t(announcementPriorityMessageKeys[announcement.priority])}
                  </Badge>,
                  announcement.pinned ? (
                    <Badge key="pinned" variant="secondary">
                      <Pin /> <T>pinned</T>
                    </Badge>
                  ) : null,
                ]}
                description={richTextToPlainText(announcement.content)}
                descriptionClassName="line-clamp-2"
                actions={
                  <>
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
                            ? "announcementUnpinned"
                            : "announcementPinned"
                        )
                      }}
                    >
                      {announcement.pinned ? (
                        <>
                          <PinOff /> <T>unpin</T>
                        </>
                      ) : (
                        <>
                          <Pin /> <T>pin</T>
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
                            ? "announcementUnpublished"
                            : "announcementPublished"
                        )
                      }}
                    >
                      <T>{announcement.published ? "unpublish" : "publish"}</T>
                    </Button>
                    <Link
                      href={`/manager/announcements/${announcement.id}/edit`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      <FilePenLine /> <T>edit</T>
                    </Link>
                    {canCreateContent && (
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(announcement)}
                        aria-label={t("deleteName", {
                          name: announcement.title,
                        })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </>
                }
              />
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="noMatchingAnnouncements"
          description="clearSearchChooseStatusFilter"
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
            showFeedback("announcementDeleted")
          }
        }}
      />
    </div>
  )
}
