"use client"

import { Link2 } from "lucide-react"

import { T } from "@/components/translated-text"
import { Button } from "@/components/ui/button"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { cn } from "@/lib/utils"

type RelatedGuideOption = {
  id: string
  title: string
  published?: boolean
}

export function RelatedGuidesPicker({
  guides,
  selectedIds,
  onChange,
  excludeGuideId,
  selectionMode = "multiple",
  title = "relatedGuides",
  className,
}: {
  guides: RelatedGuideOption[]
  selectedIds: string[]
  onChange: (guideIds: string[]) => void
  excludeGuideId?: string
  selectionMode?: "single" | "multiple"
  title?: AppMessageKey
  className?: string
}) {
  const t = useAppTranslations()
  const availableGuides = guides.filter(
    (guide) => guide.id !== excludeGuideId && guide.published
  )
  const availableGuideIds = new Set(availableGuides.map((guide) => guide.id))
  const selectedPublishedIds = selectedIds.filter((id) =>
    availableGuideIds.has(id)
  )

  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="flex items-center gap-2 text-xs font-semibold">
        <Link2 className="size-4" /> <T>{title}</T>
      </h2>
      <div
        className="flex max-h-40 flex-wrap gap-2 overflow-y-auto overscroll-contain pr-1"
        aria-label={t("selectRelatedGuides")}
      >
        {availableGuides.map((guide) => {
          const selected = selectedPublishedIds.includes(guide.id)
          return (
            <Button
              key={guide.id}
              type="button"
              size="xs"
              variant={selected ? "default" : "outline"}
              className={selected ? undefined : "bg-background"}
              aria-pressed={selected}
              onClick={() =>
                onChange(
                  selected
                    ? selectedPublishedIds.filter((id) => id !== guide.id)
                    : selectionMode === "single"
                      ? [guide.id]
                      : [...selectedPublishedIds, guide.id]
                )
              }
            >
              {guide.title}
            </Button>
          )
        })}
        {!availableGuides.length && (
          <p className="text-sm text-muted-foreground">
            <T>publishedGuidesCanBeLinked</T>
          </p>
        )}
      </div>
    </section>
  )
}
