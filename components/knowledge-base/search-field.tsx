"use client"

import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"

export function SearchField({
  value,
  onChange,
  inputRef,
}: {
  value: string
  onChange: (value: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search guides, events, announcements, documents, and questions…"
        className="h-10 border border-input bg-background pr-10 pl-10 focus-visible:border-ring"
        aria-label="Search the operations hub"
      />
      {value && (
        <button
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
