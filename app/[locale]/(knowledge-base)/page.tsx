"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { Fragment } from "react"
import { Link } from "@/i18n/navigation"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Files,
  MapPin,
  Megaphone,
} from "lucide-react"

import { AnnouncementCard } from "@/components/operations/announcement-card"
import { EmptyState } from "@/components/operations/empty-state"
import { EventCard } from "@/components/operations/event-card"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { SectionHeading } from "@/components/knowledge-base/section-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Card, CardContent } from "@/components/ui/card"
import { WorkerNotes } from "@/components/worker-notes/worker-notes"
import type { AppMessageKey } from "@/i18n/messages"
import {
  eventRendersOnDate,
  formatDate,
  formatEventDateTime,
  getAnnouncementDaysUntilDue,
  isAnnouncementActive,
  toDateKey,
  type Announcement,
  type CalendarEvent,
} from "@/lib/operations"
import {
  defaultTodaySections,
  type TodaySectionKey,
} from "@/lib/today-sections"
import { areaStyles, type AreaKey } from "@/lib/area-styles"
import { AreaIconTile } from "@/components/operations/area-icon-tile"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const quickLinks = [
  {
    href: "/guides",
    title: "guides",
    description: "findPracticalInstructionsByWorkArea",
    icon: BookOpen,
    area: "guides",
  },
  {
    href: "/calendar",
    title: "calendar",
    description: "seeReservationsTrainingAndVisits",
    icon: CalendarDays,
    area: "calendar",
  },
  {
    href: "/announcements",
    title: "announcements",
    description: "checkTemporaryOperationalUpdates",
    icon: Megaphone,
    area: "announcements",
  },
  {
    href: "/documents",
    title: "documents",
    description: "openSharedFilesAndLinks",
    icon: Files,
    area: "documents",
  },
] satisfies {
  href: string
  title: AppMessageKey
  description: AppMessageKey
  icon: typeof BookOpen
  area: AreaKey
}[]

export default function TodayPage() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { hub, guides, events, announcements } = useOperations()
  const timeZone = hub?.timeZone
  const today = toDateKey(new Date(), timeZone)
  const todayEvents = events
    .filter((event) => event.published && eventRendersOnDate(event, today))
    .sort((a, b) => a.start.localeCompare(b.start))
  const upcomingEvents = events
    .filter((event) => event.published && toDateKey(event.start) > today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 3)
  const activeAnnouncements = announcements
    .filter((announcement) =>
      isAnnouncementActive(announcement, new Date(), timeZone)
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    .slice(0, 3)
  const allActiveAnnouncements = announcements
    .filter((announcement) =>
      isAnnouncementActive(announcement, new Date(), timeZone)
    )
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))
  const urgentAnnouncement = allActiveAnnouncements.find(
    (announcement) => announcement.priority === "Urgent"
  )
  const expiringAnnouncement = allActiveAnnouncements
    .filter((announcement) => {
      const days = getAnnouncementDaysUntilDue(
        announcement,
        new Date(),
        timeZone
      )
      return days !== null && days >= 0 && days <= 2
    })
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0]
  const nextEvent = [...todayEvents, ...upcomingEvents][0]
  const attention = urgentAnnouncement
    ? ({ kind: "announcement", announcement: urgentAnnouncement } as const)
    : expiringAnnouncement
      ? ({ kind: "expiring", announcement: expiringAnnouncement } as const)
      : nextEvent
        ? ({ kind: "event", event: nextEvent } as const)
        : null
  const usefulGuides = guides
    .filter((guide) => guide.published && guide.featured)
    .slice(0, 4)

  function renderSection(key: TodaySectionKey) {
    switch (key) {
      case "welcome":
        return (
          <section
            className="relative isolate overflow-hidden border bg-primary bg-cover bg-center p-6 text-primary-foreground"
            style={
              hub?.bannerImageUrl
                ? { backgroundImage: `url("${hub.bannerImageUrl}")` }
                : undefined
            }
          >
            {hub?.bannerImageUrl && (
              <div
                className="absolute inset-0 -z-10 bg-black/55"
                aria-hidden="true"
              />
            )}
            <div>
              <p className="text-sm font-medium text-primary-foreground/80">
                {formatDate(
                  new Date().toISOString(),
                  {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  },
                  timeZone,
                  languageTag
                )}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                <T>todayAt</T> {hub?.name ?? t("yourWorkplaceLowercase")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/80 sm:text-base">
                {hub?.description ||
                  t("currentUpdatesImportantTimesGuidesNeedDuringMessage")}
              </p>
              {hub?.address && (
                <p className="mt-3 flex items-center gap-2 text-sm text-primary-foreground/80">
                  <MapPin className="size-4" /> {hub.address}
                </p>
              )}
            </div>
          </section>
        )
      case "quick-links":
        return (
          <section>
            <SectionHeading
              title="quickLinks"
              description="goToWorkhalMainAreas"
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {quickLinks.map(
                ({ href, title, description, icon: Icon, area }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <Card
                      size="sm"
                      className={cn(
                        "h-full border-l-2 shadow-none transition-all group-hover:-translate-y-0.5 group-active:translate-y-0",
                        areaStyles[area].rail,
                        areaStyles[area].hover
                      )}
                    >
                      <CardContent className="flex h-full items-start gap-3">
                        <AreaIconTile
                          area={area}
                          icon={Icon}
                          className="size-9"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            <T>{title}</T>
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            <T>{description}</T>
                          </span>
                        </span>
                        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                      </CardContent>
                    </Card>
                  </Link>
                )
              )}
            </div>
          </section>
        )
      case "happening-today":
        return (
          <section>
            <SectionHeading
              title="happeningToday"
              description="eventsImportantTimesCurrentDay"
              action={{ label: "openCalendar", href: "/calendar" }}
            />
            {todayEvents.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {todayEvents.map((event) => (
                  <EventCard key={event.id} event={event} timeZone={timeZone} />
                ))}
              </div>
            ) : (
              <EmptyState
                area="calendar"
                icon={CalendarDays}
                title="nothingScheduledToday"
                description="useCalendarLookAheadUpcomingEvents"
                actionLabel="openCalendar"
                actionHref="/calendar"
              />
            )}
          </section>
        )
      case "current-announcements":
        return (
          <section>
            <SectionHeading
              title="currentAnnouncements"
              description="temporaryInformationThatMattersRightNow"
              action={{
                label: "allAnnouncements",
                href: "/announcements",
              }}
            />
            {activeAnnouncements.length ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {activeAnnouncements.map((announcement) => (
                  <AnnouncementCard
                    key={announcement.id}
                    announcement={announcement}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                area="announcements"
                icon={Megaphone}
                title="noCurrentAnnouncements"
                description="thereAreNoActiveOperationalUpdates"
              />
            )}
          </section>
        )
      case "coming-next":
        return (
          <section>
            <SectionHeading
              title="comingNext"
              description="smallPreviewWhatAhead"
            />
            {upcomingEvents.length ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    timeZone={timeZone}
                    compact
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                area="calendar"
                icon={CalendarDays}
                title="noUpcomingEvents"
                description="publishedFutureEventsWillAppearHere"
                actionLabel="openCalendar"
                actionHref="/calendar"
              />
            )}
          </section>
        )
      case "useful-guides":
        return (
          <section>
            <SectionHeading
              title="usefulGuides"
              description="frequentlyUsedInstructionsSmoothShift"
              action={{ label: "allGuides", href: "/guides" }}
            />
            {usefulGuides.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {usefulGuides.map((guide) => (
                  <GuideCard key={guide.id} guide={guide} />
                ))}
              </div>
            ) : (
              <EmptyState
                area="guides"
                icon={BookOpen}
                title="noUsefulGuidesYet"
                description="featuredPublishedGuidesWillAppearHere"
                actionLabel="allGuides"
                actionHref="/guides"
              />
            )}
          </section>
        )
    }
  }

  return (
    <>
      <div className="space-y-6">
        {(hub?.todaySections ?? defaultTodaySections)
          .filter((section) => section.visible)
          .map((section) => (
            <Fragment key={section.key}>
              {renderSection(section.key)}
              {section.key === "welcome" && attention && (
                <AttentionCard
                  attention={attention}
                  timeZone={timeZone}
                  languageTag={languageTag}
                />
              )}
            </Fragment>
          ))}
        {!(hub?.todaySections ?? defaultTodaySections).some(
          (section) => section.visible && section.key === "welcome"
        ) &&
          attention && (
            <AttentionCard
              attention={attention}
              timeZone={timeZone}
              languageTag={languageTag}
            />
          )}
      </div>
      <WorkerNotes key={hub?.id ?? "no-workplace"} />
    </>
  )
}

type TodayAttention =
  | {
      kind: "announcement" | "expiring"
      announcement: Announcement
    }
  | {
      kind: "event"
      event: CalendarEvent
    }

function AttentionCard({
  attention,
  timeZone,
  languageTag,
}: {
  attention: TodayAttention
  timeZone?: string
  languageTag: string
}) {
  const t = useAppTranslations()
  const isEvent = attention.kind === "event"
  const title = isEvent ? attention.event.title : attention.announcement.title
  const href = isEvent
    ? `/calendar/${attention.event.id}`
    : `/announcements/${attention.announcement.id}`
  const chip = isEvent
    ? formatEventDateTime(attention.event, timeZone, languageTag, t("allDay"))
    : attention.kind === "announcement"
      ? t("urgentUpdate")
      : t("expiresSoon")
  const description = isEvent
    ? attention.event.description
    : attention.kind === "announcement"
      ? t("urgentUpdateNeedsReview")
      : t("updateExpiresSoonReviewNow")
  const area: AreaKey = isEvent ? "calendar" : "announcements"
  const Icon = isEvent ? Clock3 : Megaphone

  return (
    <section
      className={cn(
        "border border-l-2 bg-card p-5 shadow-sm",
        areaStyles[area].rail
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <AreaIconTile area={area} icon={Icon} className="size-11" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={areaStyles[area].tile}>{chip}</Badge>
          </div>
          <h2 className="mt-2 text-lg font-semibold">{title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0"
          )}
        >
          <T>viewDetails</T> <ArrowRight />
        </Link>
      </div>
    </section>
  )
}
