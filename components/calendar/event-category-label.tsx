import { LockKeyhole } from "lucide-react"

import { useAppTranslations } from "@/i18n/use-app-translations"
import {
  DEPUTY_SCHEDULES_EVENT_TYPE_ID,
  eventCategoryLabel,
  type CategoryLike,
} from "@/lib/categories"

export function EventCategoryLabel({
  category,
  eventTypes,
  isPrivate = false,
  showSchedulePrivacy = false,
}: {
  category: string
  eventTypes: readonly CategoryLike[]
  isPrivate?: boolean
  showSchedulePrivacy?: boolean
}) {
  const t = useAppTranslations()
  const locked =
    isPrivate ||
    (showSchedulePrivacy && category === DEPUTY_SCHEDULES_EVENT_TYPE_ID)

  return (
    <span className="inline-flex items-center gap-1.5">
      {eventCategoryLabel(category, eventTypes)}
      {locked && (
        <LockKeyhole
          className="size-3"
          aria-label={t("privateEvent")}
          role="img"
        />
      )}
    </span>
  )
}
