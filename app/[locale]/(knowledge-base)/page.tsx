"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { Fragment } from "react"
import { Link } from "@/i18n/navigation"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
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
import type { AppMessageKey } from "@/i18n/messages"
import {
  eventOccursOnDate,
  formatDate,
  isAnnouncementActive,
  toDateKey,
} from "@/lib/operations"
import {
  defaultTodaySections,
  type TodaySectionKey,
} from "@/lib/today-sections"

const quickLinks = [
  {
    href: "/guides",
    title: "guides",
    description: "findPracticalInstructionsByWorkArea",
    icon: BookOpen,
  },
  {
    href: "/calendar",
    title: "calendar",
    description: "seeReservationsTrainingAndVisits",
    icon: CalendarDays,
  },
  {
    href: "/announcements",
    title: "announcements",
    description: "checkTemporaryOperationalUpdates",
    icon: Megaphone,
  },
] satisfies {
  href: string
  title: AppMessageKey
  description: AppMessageKey
  icon: typeof BookOpen
}[]

export default function TodayPage() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { hub, guides, events, announcements } = useOperations()
  const timeZone = hub?.timeZone
  const today = toDateKey(new Date(), timeZone)
  const todayEvents = events
    .filter((event) => event.published && eventOccursOnDate(event, today))
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
            <div className="grid gap-3 md:grid-cols-3">
              {quickLinks.map(({ href, title, description, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <Card
                    size="sm"
                    className="h-full shadow-none transition-colors group-hover:bg-muted/40"
                  >
                    <CardContent className="flex h-full items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
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
              ))}
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
                icon={CalendarDays}
                title="nothingScheduledToday"
                description="useCalendarLookAheadUpcomingEvents"
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
                icon={CalendarDays}
                title="noUpcomingEvents"
                description="publishedFutureEventsWillAppearHere"
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
                icon={BookOpen}
                title="noUsefulGuidesYet"
                description="featuredPublishedGuidesWillAppearHere"
              />
            )}
          </section>
        )
    }
  }

  return (
    <div className="space-y-6">
      {(hub?.todaySections ?? defaultTodaySections)
        .filter((section) => section.visible)
        .map((section) => (
          <Fragment key={section.key}>{renderSection(section.key)}</Fragment>
        ))}
    </div>
  )
}
