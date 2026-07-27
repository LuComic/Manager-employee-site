"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Input } from "@/components/ui/input"
import { usePathname, useRouter } from "@/i18n/navigation"
import { useAppTranslations } from "@/i18n/use-app-translations"

const SEARCH_DEBOUNCE_MS = 300

export function SearchField({
  inputRef,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const pathname = usePathname()
  const t = useAppTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery =
    pathname === "/search" ? (searchParams.get("q")?.trim() ?? "") : ""
  const [draft, setDraft] = useState({
    pathname,
    source: urlQuery,
    value: urlQuery,
  })
  const draftMatchesLocation =
    draft.pathname === pathname && draft.source === urlQuery

  if (!draftMatchesLocation) {
    setDraft({ pathname, source: urlQuery, value: urlQuery })
  }

  const value = draftMatchesLocation ? draft.value : urlQuery
  const pendingSearch = useRef<number | undefined>(undefined)

  const commitSearch = useCallback(
    (nextQuery: string) => {
      const normalizedQuery = nextQuery.trim()
      const params = new URLSearchParams()
      if (normalizedQuery) params.set("q", normalizedQuery)

      const hub = searchParams.get("hub")?.trim()
      if (hub) params.set("hub", hub)

      const queryString = params.toString()
      const href = queryString ? `/search?${queryString}` : "/search"

      if (pathname === "/search") {
        router.replace(href, { scroll: false })
      } else if (normalizedQuery) {
        router.push(href)
      }
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    const normalizedValue = value.trim()
    if (!normalizedValue || normalizedValue === urlQuery) return

    pendingSearch.current = window.setTimeout(() => {
      commitSearch(normalizedValue)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(pendingSearch.current)
      pendingSearch.current = undefined
    }
  }, [commitSearch, urlQuery, value])

  function cancelPendingSearch() {
    window.clearTimeout(pendingSearch.current)
    pendingSearch.current = undefined
  }

  function updateValue(nextValue: string) {
    setDraft({ pathname, source: urlQuery, value: nextValue })
    if (!nextValue.trim() && pathname === "/search") {
      cancelPendingSearch()
      commitSearch("")
    }
  }

  return (
    <form
      role="search"
      aria-label={t("searchWorkhal")}
      className="relative w-full max-w-xl"
      onSubmit={(event) => {
        event.preventDefault()
        cancelPendingSearch()
        commitSearch(value)
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        placeholder={t("searchGuidesEventsAnnouncementsDocumentsQuestions")}
        className="h-10 border border-input bg-background pr-10 pl-10 focus-visible:border-ring"
        aria-label={t("searchWorkhal")}
      />
      {value && (
        <button
          type="button"
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => updateValue("")}
          aria-label={t("clearSearch")}
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  )
}
