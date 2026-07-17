"use client"

import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FilePenLine,
  Megaphone,
  Tags,
} from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { useOperations } from "@/components/providers/operations-provider"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getAnnouncementState } from "@/lib/operations"

export function ManagerOverview() {
  const { categories, guides, events, announcements } = useOperations()
  const cards = [
    {
      href: "/manager/categories",
      title: "Guide categories",
      count: categories.length,
      detail: "Shown in guide navigation",
      icon: Tags,
    },
    {
      href: "/manager/guides",
      title: "Guides",
      count: guides.length,
      detail: `${guides.filter((item) => item.published).length} published`,
      icon: BookOpen,
    },
    {
      href: "/manager/calendar",
      title: "Calendar events",
      count: events.length,
      detail: `${events.filter((item) => item.published).length} published`,
      icon: CalendarDays,
    },
    {
      href: "/manager/announcements",
      title: "Announcements",
      count: announcements.length,
      detail: `${announcements.filter((item) => getAnnouncementState(item) === "Active").length} active`,
      icon: Megaphone,
    },
  ]
  const drafts =
    guides.filter((item) => !item.published).length +
    events.filter((item) => !item.published).length +
    announcements.filter((item) => !item.published).length
  return (
    <div className="space-y-8">
      <ManagerHeading
        title="Content overview"
        description="Counts are calculated from the current demo state and update as content changes."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ href, title, count, detail, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <Card className="h-full shadow-none transition-shadow group-hover:shadow-md">
              <CardHeader>
                <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <CardTitle className="mt-4 text-base">{title}</CardTitle>
                <CardDescription>{detail}</CardDescription>
              </CardHeader>
              <CardFooter className="mt-auto justify-between">
                <span className="text-3xl font-semibold">{count}</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <span className="flex size-10 items-center justify-center bg-muted text-muted-foreground">
            <FilePenLine className="size-5" />
          </span>
          <CardTitle className="mt-4 text-base">Draft content</CardTitle>
          <CardDescription>
            {drafts === 0
              ? "Everything is currently published."
              : `${drafts} ${drafts === 1 ? "item is" : "items are"} still in draft. Open a management view to review or publish it.`}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
