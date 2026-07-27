import { T } from "@/components/providers/i18n-provider"

import type { Metadata } from "next"
import { Search } from "lucide-react"

import { SearchResults } from "@/components/knowledge-base/search-results"
import { PageHeading } from "@/components/operations/page-heading"
import { isLocale } from "@/i18n/config"
import { getMessages } from "@/i18n/messages"

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const messages = await getMessages(lang)

  return {
    title: messages["Search | Operations hub"],
    description:
      messages["Search the operations hub for published workplace content."],
    robots: {
      index: false,
      follow: true,
    },
  }
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
        <h2 className="mt-4 text-lg font-semibold">
          <T>What are you looking for?</T>
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          <T>Type in the search field above to search all published content.</T>
        </p>
      </div>
    </div>
  )
}
