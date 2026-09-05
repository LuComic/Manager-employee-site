"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { useState } from "react"
import { ArrowLeft, CalendarDays, Check, Megaphone, Pin } from "lucide-react"

import { EmptyState } from "@/components/operations/empty-state"
import { RichTextContent } from "@/components/rich-text/rich-text-content"
import { RelatedInformation } from "@/components/operations/related-information"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  announcementStateMessageKeys,
  formatDate,
  getAnnouncementState,
  type Announcement,
  type CalendarEvent,
} from "@/lib/operations"
import type { Guide } from "@/lib/knowledge-base"
import { cn } from "@/lib/utils"
import {
  AnnouncementPriorityBadge,
  announcementPriorityRail,
} from "@/components/announcements/announcement-priority-badge"

export function AnnouncementDetail({
  announcementId,
}: {
  announcementId: string
}) {
  const { announcements, guides, events } = useOperations()
  const announcement = announcements.find(
    (item) => item.id === announcementId && item.published
  )
  if (!announcement)
    return (
      <EmptyState
        area="announcements"
        icon={Megaphone}
        title="announcementNotAvailable"
        description="announcementUnpublishedRemovedReturnAnnouncementsCurrentUpdates"
      />
    )
  const guide = guides.find(
    (item) => item.id === announcement.guideId && item.published
  )
  const event = events.find(
    (item) => item.id === announcement.eventId && item.published
  )
  return (
    <AnnouncementArticle
      announcement={announcement}
      guide={guide}
      event={event}
    />
  )
}

export function AnnouncementArticle({
  announcement,
  guide,
  event,
  preview = false,
}: {
  announcement: Announcement
  guide?: Guide
  event?: CalendarEvent
  preview?: boolean
}) {
  const t = useAppTranslations()
  const { hub, acknowledgeAnnouncement, showFeedback } = useOperations()
  const languageTag = useLanguageTag()
  const state = getAnnouncementState(announcement, new Date(), hub?.timeZone)
  const [acknowledging, setAcknowledging] = useState(false)
  const canAcknowledge =
    !preview &&
    state === "Active" &&
    announcement.priority !== "Normal" &&
    announcement.acknowledged !== undefined
  return (
    <article className="mx-auto max-w-4xl space-y-6">
      {!preview && (
        <Link
          href="/announcements"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "tracking-normal normal-case"
          )}
        >
          <ArrowLeft data-icon="inline-start" /> <T>backToAnnouncements</T>
        </Link>
      )}
      <Card
        className={cn(
          "border-l-2 shadow-none",
          announcementPriorityRail(announcement.priority)
        )}
      >
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center gap-4">
            <AnnouncementPriorityBadge priority={announcement.priority} />
            <Badge variant="secondary">
              {t(announcementStateMessageKeys[state])}
            </Badge>
            {announcement.pinned && (
              <Badge className="border border-dashed border-foreground/20 px-2 py-1 text-foreground">
                <Pin /> <T>featured</T>
              </Badge>
            )}
          </div>
          <CardTitle>
            <h1 className="text-2xl tracking-tight">{announcement.title}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextContent content={announcement.content} />
          <div className="mt-6 flex flex-wrap gap-4 border-t pt-4 text-sm text-muted-foreground">
            <span>
              <T>published</T>{" "}
              {formatDate(
                `${announcement.publishedAt}T12:00`,
                undefined,
                hub?.timeZone,
                languageTag
              )}
            </span>
            <span>
              <T>expires</T>{" "}
              {formatDate(
                `${announcement.expiresAt}T12:00`,
                undefined,
                hub?.timeZone,
                languageTag
              )}
            </span>
          </div>
          {canAcknowledge && (
            <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                <T>
                  {announcement.acknowledged
                    ? "youConfirmedThisUpdate"
                    : "confirmYouHaveSeenThisUpdate"}
                </T>
              </p>
              <Button
                size="sm"
                variant={announcement.acknowledged ? "outline" : "default"}
                disabled={announcement.acknowledged || acknowledging}
                onClick={async () => {
                  setAcknowledging(true)
                  try {
                    await acknowledgeAnnouncement(announcement.id)
                    showFeedback("markedAsSeen")
                  } finally {
                    setAcknowledging(false)
                  }
                }}
              >
                <Check />
                <T>{announcement.acknowledged ? "seen" : "markAsSeen"}</T>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <RelatedInformation
        guides={guide ? [guide] : []}
        events={event ? [event] : []}
        timeZone={hub?.timeZone}
      />
      {!preview && !event && announcement.eventId && (
        <EmptyState
          area="calendar"
          icon={CalendarDays}
          title="relatedEventIsNotPublished"
          description="linkedEventNotCurrentlyAvailableEmployees"
        />
      )}
    </article>
  )
}
