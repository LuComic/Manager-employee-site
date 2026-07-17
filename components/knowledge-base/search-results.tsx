"use client"

import Link from "next/link"
import { BookOpen, CalendarDays, Megaphone, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useOperations } from "@/components/providers/operations-provider"
import { getAnnouncementState } from "@/lib/operations"
import { richTextToPlainText } from "@/lib/rich-text"

type Result = {
  id: string
  href: string
  title: string
  description: string
  type: "Guide" | "Event" | "Announcement"
}

export function SearchResults({
  query,
  onNavigate,
}: {
  query: string
  onNavigate: () => void
}) {
  const { categories, guides, events, announcements } = useOperations()
  const cleanQuery = query.trim().toLowerCase()
  const includes = (...values: (string | string[] | undefined)[]) =>
    values.flat().filter(Boolean).join(" ").toLowerCase().includes(cleanQuery)

  const results: Result[] = [
    ...guides
      .filter(
        (guide) =>
          guide.published &&
          includes(
            guide.title,
            guide.description,
            guide.keywords,
            richTextToPlainText(guide.content),
            categories.find((category) => category.id === guide.category)?.label
          )
      )
      .map((guide) => ({
        id: guide.id,
        href: `/guides/${guide.id}`,
        title: guide.title,
        description: guide.description,
        type: "Guide" as const,
      })),
    ...events
      .filter(
        (event) =>
          event.published &&
          includes(
            event.title,
            event.description,
            event.category,
            event.location,
            event.owner,
            event.notes
          )
      )
      .map((event) => ({
        id: event.id,
        href: `/calendar/${event.id}`,
        title: event.title,
        description: event.description,
        type: "Event" as const,
      })),
    ...announcements
      .filter(
        (announcement) =>
          announcement.published &&
          getAnnouncementState(announcement) !== "Expired" &&
          includes(
            announcement.title,
            richTextToPlainText(announcement.content),
            announcement.priority
          )
      )
      .map((announcement) => ({
        id: announcement.id,
        href: `/announcements/${announcement.id}`,
        title: announcement.title,
        description: richTextToPlainText(announcement.content),
        type: "Announcement" as const,
      })),
  ]

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Search results</h1>
      <p className="mt-2 text-muted-foreground">
        {results.length} {results.length === 1 ? "result" : "results"} found for
        “{query.trim()}”
      </p>
      {results.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((result) => {
            const Icon =
              result.type === "Guide"
                ? BookOpen
                : result.type === "Event"
                  ? CalendarDays
                  : Megaphone
            return (
              <Link
                key={`${result.type}-${result.id}`}
                href={result.href}
                onClick={onNavigate}
                className="group h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <Card className="h-full shadow-none transition-shadow group-hover:shadow-md">
                  <CardHeader>
                    <span className="mb-4 flex size-10 items-center justify-center bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <Badge variant="secondary">{result.type}</Badge>
                    <CardTitle className="text-base">{result.title}</CardTitle>
                    <CardDescription>{result.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center border bg-background p-8 text-center">
          <span className="flex size-12 items-center justify-center bg-muted text-muted-foreground">
            <Search className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">No matching content</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Try a shorter word or browse one of the main areas.
          </p>
        </div>
      )}
    </div>
  )
}
