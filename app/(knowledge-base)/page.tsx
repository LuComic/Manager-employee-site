"use client"

import { Fragment } from "react"
import Link from "next/link"
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
    title: "Guides",
    description: "Find practical instructions by work area.",
    icon: BookOpen,
  },
  {
    href: "/calendar",
    title: "Calendar",
    description: "See reservations, training, and visits.",
    icon: CalendarDays,
  },
  {
    href: "/announcements",
    title: "Announcements",
    description: "Check temporary operational updates.",
    icon: Megaphone,
  },
]

export default function TodayPage() {
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
                  timeZone
                )}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Today at {hub?.name ?? "your workplace"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/80 sm:text-base">
                {hub?.description ||
                  "Current updates, important times, and the guides you may need during the day."}
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
              title="Quick links"
              description="Go straight to the main areas of the operations hub."
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
                        <span className="block font-semibold">{title}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {description}
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
              title="Happening today"
              description="Events and important times for the current day."
              action={{ label: "Open calendar", href: "/calendar" }}
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
                title="Nothing scheduled today"
                description="Use the calendar to look ahead at upcoming events."
              />
            )}
          </section>
        )
      case "current-announcements":
        return (
          <section>
            <SectionHeading
              title="Current announcements"
              description="Temporary information that matters right now."
              action={{
                label: "View announcements",
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
                title="No current announcements"
                description="There are no active operational updates."
              />
            )}
          </section>
        )
      case "coming-next":
        return (
          <section>
            <SectionHeading
              title="Coming next"
              description="A small preview of what is ahead."
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
                title="No upcoming events"
                description="Published future events will appear here."
              />
            )}
          </section>
        )
      case "useful-guides":
        return (
          <section>
            <SectionHeading
              title="Useful guides"
              description="Frequently used instructions for a smooth shift."
              action={{ label: "Browse all guides", href: "/guides" }}
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
                title="No useful guides yet"
                description="Featured published guides will appear here."
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
