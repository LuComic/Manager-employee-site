import { CircleAlert, Info, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useAppTranslations } from "@/i18n/use-app-translations"
import {
  announcementPriorityMessageKeys,
  type AnnouncementPriority,
} from "@/lib/operations"
import { cn } from "@/lib/utils"

const priorityStyles = {
  Normal: {
    icon: Info,
    badge: "text-teal-700 dark:text-teal-300",
    rail: "border-l-teal-400 dark:border-l-teal-500",
  },
  Important: {
    icon: CircleAlert,
    badge: "text-amber-700 dark:text-amber-300",
    rail: "border-l-amber-400 dark:border-l-amber-500",
  },
  Urgent: {
    icon: TriangleAlert,
    badge: "text-red-700 dark:text-red-300",
    rail: "border-l-red-400 dark:border-l-red-500",
  },
} satisfies Record<
  AnnouncementPriority,
  { icon: typeof Info; badge: string; rail: string }
>

export function announcementPriorityRail(priority: AnnouncementPriority) {
  return priorityStyles[priority].rail
}

export function AnnouncementPriorityBadge({
  priority,
  className,
}: {
  priority: AnnouncementPriority
  className?: string
}) {
  const t = useAppTranslations()
  const style = priorityStyles[priority]
  const Icon = style.icon

  return (
    <Badge className={cn(style.badge, className)}>
      <Icon /> {t(announcementPriorityMessageKeys[priority])}
    </Badge>
  )
}
