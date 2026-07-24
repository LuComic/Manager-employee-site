"use client"

import Link from "next/link"
import { ArrowLeft, CalendarDays, Megaphone, Pin } from "lucide-react"

import { EmptyState } from "@/components/operations/empty-state"
import { RichTextContent } from "@/components/rich-text/rich-text-content"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { EventCard } from "@/components/operations/event-card"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  formatDate,
  getAnnouncementState,
  type Announcement,
  type CalendarEvent,
} from "@/lib/operations"
import type { Guide } from "@/lib/knowledge-base"
import { cn } from "@/lib/utils"

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
        icon={Megaphone}
        title="Announcement not available"
        description="This announcement may be unpublished or removed. Return to announcements for current updates."
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
  const { hub } = useOperations()
  const state = getAnnouncementState(announcement, new Date(), hub?.timeZone)
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
          <ArrowLeft /> Back to announcements
        </Link>
      )}
      <Card className="shadow-none">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center gap-4">
            <Badge
              variant={
                announcement.priority === "Urgent" ? "destructive" : "secondary"
              }
            >
              {announcement.priority}
            </Badge>
            <Badge variant="secondary">{state}</Badge>
            {announcement.pinned && (
              <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Pin className="size-3" /> Pinned
              </span>
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
              Published{" "}
              {formatDate(
                `${announcement.publishedAt}T12:00`,
                undefined,
                hub?.timeZone
              )}
            </span>
            <span>
              Expires{" "}
              {formatDate(
                `${announcement.expiresAt}T12:00`,
                undefined,
                hub?.timeZone
              )}
            </span>
          </div>
        </CardContent>
      </Card>
      {(event || guide) && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Related information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {event && (
              <EventCard event={event} timeZone={hub?.timeZone} compact />
            )}
            {guide && <GuideCard guide={guide} />}
          </div>
        </section>
      )}
      {!preview && !event && announcement.eventId && (
        <EmptyState
          icon={CalendarDays}
          title="Related event is not published"
          description="The linked event is not currently available to employees."
        />
      )}
    </article>
  )
}
