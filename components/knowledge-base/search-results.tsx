import { Search } from "lucide-react"

import { GuideCard } from "@/components/knowledge-base/guide-card"
import { guides } from "@/lib/knowledge-base"

export function SearchResults({ query, onNavigate }: { query: string; onNavigate: () => void }) {
  const cleanQuery = query.trim().toLowerCase()
  const results = guides.filter((guide) => {
    const searchable = [
      guide.title,
      guide.description,
      ...guide.steps.flatMap((step) => [step.title, step.detail]),
    ]
      .join(" ")
      .toLowerCase()

    return searchable.includes(cleanQuery)
  })

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Search results</h1>
      <p className="mt-2 text-muted-foreground">
        {results.length} {results.length === 1 ? "guide" : "guides"} found for “{query.trim()}”
      </p>
      {results.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((guide) => (
            <GuideCard key={guide.id} guide={guide} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center border bg-background p-8 text-center">
          <span className="flex size-12 items-center justify-center bg-muted text-muted-foreground">
            <Search className="size-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">No matching guides</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Try a shorter word or browse the guides by work area.
          </p>
        </div>
      )}
    </div>
  )
}
