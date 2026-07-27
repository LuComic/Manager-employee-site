import { Link } from "@/i18n/navigation"
import { ArrowRight, Clock3, MapPin } from "lucide-react"

import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  eventCategoryMessageKeys,
  formatEventDate,
  formatEventTime,
  type CalendarEvent,
} from "@/lib/operations"

export function EventCard({
  event,
  timeZone,
  compact = false,
}: {
  event: CalendarEvent
  timeZone?: string
  compact?: boolean
}) {
  const languageTag = useLanguageTag()
  const t = useAppTranslations()

  return (
    <Link
      href={`/calendar/${event.id}`}
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card
        size="sm"
        className="h-full shadow-none transition-colors group-hover:bg-muted/40"
      >
        <CardHeader>
          <Badge variant="secondary">
            {t(eventCategoryMessageKeys[event.category])}
          </Badge>
          <CardTitle className="text-base">{event.title}</CardTitle>
          <CardDescription className={compact ? "line-clamp-2" : undefined}>
            {event.description}
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto flex-wrap justify-between gap-4 text-xs text-muted-foreground">
          <span className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2">
              <Clock3 className="size-4" />{" "}
              {formatEventDate(event, undefined, timeZone, languageTag)},{" "}
              {formatEventTime(event, timeZone, languageTag, t("allDay"))}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="size-4" /> {event.location}
            </span>
          </span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </CardFooter>
      </Card>
    </Link>
  )
}
