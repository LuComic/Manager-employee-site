"use client"

import Link from "next/link"
import { ArrowLeft, CalendarDays, Megaphone, Pin } from "lucide-react"

import { EmptyState } from "@/components/operations/empty-state"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { EventCard } from "@/components/operations/event-card"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate, getAnnouncementState } from "@/lib/operations"
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
  const state = getAnnouncementState(announcement)

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/announcements"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "tracking-normal normal-case"
        )}
      >
        <ArrowLeft /> Back to announcements
      </Link>
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
            <h1 className="text-3xl tracking-tight sm:text-4xl">
              {announcement.title}
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base leading-7 whitespace-pre-wrap">
            {announcement.message}
          </p>
          <div className="mt-8 flex flex-wrap gap-6 border-t pt-6 text-sm text-muted-foreground">
            <span>
              Published {formatDate(`${announcement.publishedAt}T12:00`)}
            </span>
            <span>Expires {formatDate(`${announcement.expiresAt}T12:00`)}</span>
          </div>
        </CardContent>
      </Card>
      {(event || guide) && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Related information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {event && <EventCard event={event} compact />}
            {guide && <GuideCard guide={guide} />}
          </div>
        </section>
      )}
      {!event && announcement.eventId && (
        <EmptyState
          icon={CalendarDays}
          title="Related event is not published"
          description="The linked event is not currently available to employees."
        />
      )}
    </article>
  )
}
