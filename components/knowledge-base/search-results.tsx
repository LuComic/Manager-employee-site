"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  Files,
  Megaphone,
  Search,
} from "lucide-react"
import { useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import { Badge } from "@/components/ui/badge"
import { PageHeading } from "@/components/operations/page-heading"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useOperations } from "@/components/providers/operations-provider"
import { toDateKey } from "@/lib/operations"

type Result = {
  id: string
  href: string
  title: string
  description: string
  type: "Guide" | "Event" | "Announcement" | "Question" | "Document"
}

export function SearchResults({ query }: { query: string }) {
  const t = useAppTranslations()
  const { hub, hubSlug, credential } = useOperations()
  const normalizedQuery = query.trim()

  const results = useQuery(
    api.search.published,
    normalizedQuery
      ? {
          hubSlug,
          credential,
          query: normalizedQuery,
          nowDate: toDateKey(new Date(), hub?.timeZone),
        }
      : "skip"
  ) as Result[] | undefined

  return (
    <div aria-busy={results === undefined}>
      <PageHeading
        title="Search results"
        description={
          results === undefined
            ? t("Searching for “{query}”…", { query: normalizedQuery })
            : t(
                results.length === 1
                  ? "{count} result found for “{query}”"
                  : "{count} results found for “{query}”",
                { count: results.length, query: normalizedQuery }
              )
        }
      />
      {results === undefined ? (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          <T>Searching…</T>
        </p>
      ) : results.length > 0 ? (
        <>
          <p className="sr-only" role="status">
            {t(
              results.length === 1
                ? "{count} result found."
                : "{count} results found.",
              { count: results.length }
            )}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((result) => {
              const Icon =
                result.type === "Guide"
                  ? BookOpen
                  : result.type === "Event"
                    ? CalendarDays
                    : result.type === "Announcement"
                      ? Megaphone
                      : result.type === "Document"
                        ? Files
                        : CircleHelp
              return (
                <Link
                  key={`${result.type}-${result.id}`}
                  href={result.href}
                  className="group h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <Card
                    size="sm"
                    className="h-full shadow-none transition-colors group-hover:bg-muted/40"
                  >
                    <CardHeader>
                      <span className="mb-2 flex size-9 items-center justify-center bg-primary/10 text-primary">
                        <Icon className="size-4" />
                      </span>
                      <Badge variant="secondary">{result.type}</Badge>
                      <CardTitle className="text-base">
                        {result.title}
                      </CardTitle>
                      <CardDescription>{result.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <p className="sr-only" role="status">
            <T>No results found.</T>
          </p>
          <div className="mt-6 flex min-h-40 flex-col items-center justify-center border bg-background p-6 text-center">
            <span className="flex size-10 items-center justify-center bg-muted text-muted-foreground">
              <Search className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">
              <T>No matching content</T>
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              <T>Try a shorter word or browse one of the main areas.</T>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
