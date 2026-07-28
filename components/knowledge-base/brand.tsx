"use client"

import { useAppTranslations } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"

import { BrandMark } from "@/components/brand-mark"
import { useOperations } from "@/components/providers/operations-provider"
import { SITE_NAME } from "@/lib/branding"

export function Brand({
  compact = false,
  onNavigate,
  linked = true,
}: {
  compact?: boolean
  onNavigate?: () => void
  linked?: boolean
}) {
  const t = useAppTranslations()
  const { hub, hubSlug, isManagerRoute } = useOperations()
  const content = (
    <>
      <BrandMark className="size-10" />
      {compact && <span className="sr-only">{SITE_NAME}</span>}
      {!compact && (
        <span>
          <span className="block font-semibold tracking-tight">
            {SITE_NAME}
          </span>
          <span className="block text-xs text-muted-foreground">
            {hub?.name ?? t("workplace")}
          </span>
        </span>
      )}
    </>
  )

  if (!linked) return <div className="flex items-center gap-3">{content}</div>

  return (
    <Link
      href={isManagerRoute ? "/manager" : `/?hub=${hubSlug}`}
      className="flex items-center gap-3"
      onClick={onNavigate}
    >
      {content}
    </Link>
  )
}
