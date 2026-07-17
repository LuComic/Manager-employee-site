"use client"

import Link from "next/link"
import { BookOpen, CalendarDays, Megaphone, Search } from "lucide-react"
import { useQuery } from "convex/react"

import { api } from "@/convex/_generated/api"
import { Badge } from "@/components/ui/badge"
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
  type: "Guide" | "Event" | "Announcement"
}

export function SearchResults({ query }: { query: string }) {
  const { hubSlug, credential } = useOperations()
  const results = useQuery(api.search.published, {
    hubSlug,
    credential,
    query,
    nowDate: toDateKey(new Date()),
  }) as Result[] | undefined

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Search results</h1>
      <p className="mt-2 text-muted-foreground">
        {results?.length ?? 0} {results?.length === 1 ? "result" : "results"}{" "}
        found for “{query.trim()}”
      </p>
      {results === undefined ? (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          Searching…
        </p>
      ) : results.length > 0 ? (
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
