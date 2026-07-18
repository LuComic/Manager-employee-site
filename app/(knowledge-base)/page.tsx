"use client"

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
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate, isAnnouncementActive, toDateKey } from "@/lib/operations"

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
    .filter((event) => event.published && toDateKey(event.start) === today)
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

  return (
    <div className="space-y-8">
      <section className="border bg-primary p-8 text-primary-foreground">
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Today at {hub?.name ?? "your workplace"}
        </h1>
        <p className="mt-4 max-w-2xl text-primary-foreground/80">
          {hub?.description ||
            "Current updates, important times, and the guides you may need during the day."}
        </p>
        {hub?.address && (
          <p className="mt-4 flex items-center gap-2 text-sm text-primary-foreground/80">
            <MapPin className="size-4" /> {hub.address}
          </p>
        )}
      </section>

      <section>
        <SectionHeading
          title="Quick links"
          description="Go straight to the main areas of the operations hub."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {quickLinks.map(({ href, title, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <Card className="h-full shadow-none transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <span className="mb-4 flex size-10 items-center justify-center bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <CardTitle className="flex items-center justify-between text-base">
                    {title}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading
          title="Happening today"
          description="Events and important times for the current day."
          action={{ label: "Open calendar", href: "/calendar" }}
        />
        {todayEvents.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {todayEvents.map((event) => (
              <EventCard key={event.id} event={event} />
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

      <section>
        <SectionHeading
          title="Current announcements"
          description="Temporary information that matters right now."
          action={{ label: "View announcements", href: "/announcements" }}
        />
        {activeAnnouncements.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
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

      <section>
        <SectionHeading
          title="Coming next"
          description="A small preview of what is ahead."
        />
        {upcomingEvents.length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
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

      <section>
        <SectionHeading
          title="Useful guides"
          description="Frequently used instructions for a smooth shift."
          action={{ label: "Browse all guides", href: "/guides" }}
        />
        {usefulGuides.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
    </div>
  )
}
