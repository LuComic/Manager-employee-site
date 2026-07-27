import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Search } from "lucide-react"

import { SearchResults } from "@/components/knowledge-base/search-results"
import { PageHeading } from "@/components/operations/page-heading"
import { T } from "@/components/translated-text"
import { routing } from "@/i18n/routing"
import { getMessageKey } from "@/i18n/messages"

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/search">): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: "App" })

  return {
    title: t(getMessageKey("Search")),
    description: t(
      getMessageKey("Search workhal for published workplace content.")
    ),
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
        description="Find guides, events, announcements, documents, and questions in workhal."
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
