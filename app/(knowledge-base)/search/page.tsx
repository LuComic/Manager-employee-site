import type { Metadata } from "next"
import { Search } from "lucide-react"

import { SearchResults } from "@/components/knowledge-base/search-results"
import { PageHeading } from "@/components/operations/page-heading"

export const metadata: Metadata = {
  title: "Search | Operations hub",
  description: "Search the operations hub for published workplace content.",
  robots: {
    index: false,
    follow: true,
  },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const value = (await searchParams).q
  const query = (Array.isArray(value) ? value[0] : value)?.trim() ?? ""

  if (query) return <SearchResults query={query} />

  return (
    <div>
      <PageHeading
        title="Search"
        description="Find guides, events, announcements, documents, and questions across the operations hub."
      />
      <div className="mt-6 flex min-h-40 flex-col items-center justify-center border bg-background p-6 text-center">
        <span className="flex size-10 items-center justify-center bg-muted text-muted-foreground">
          <Search className="size-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold">What are you looking for?</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Type in the search field above to search all published content.
        </p>
      </div>
    </div>
  )
}
