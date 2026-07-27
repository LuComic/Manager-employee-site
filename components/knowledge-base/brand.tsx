"use client"

import { T, useI18n } from "@/components/providers/i18n-provider"

import { LocalizedLink as Link } from "@/components/localized-link"
import { BriefcaseBusiness } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"

export function Brand({
  compact = false,
  onNavigate,
  linked = true,
}: {
  compact?: boolean
  onNavigate?: () => void
  linked?: boolean
}) {
  const { t } = useI18n()
  const { hub, hubSlug, isManagerRoute } = useOperations()
  const content = (
    <>
      <span className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
        <BriefcaseBusiness className="size-5" />
      </span>
      {!compact && (
        <span>
          <span className="block font-semibold tracking-tight">
            <T>Operations hub</T>
          </span>
          <span className="block text-xs text-muted-foreground">
            {hub?.name ?? t("Operations hub")}
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
