import { T } from "@/components/translated-text"

import { GuideCard } from "@/components/knowledge-base/guide-card"
import { EventCard } from "@/components/operations/event-card"
import type { Guide } from "@/lib/knowledge-base"
import type { CalendarEvent } from "@/lib/operations"
import { cn } from "@/lib/utils"

export function RelatedInformation({
  guides = [],
  events = [],
  timeZone,
  className,
}: {
  guides?: Guide[]
  events?: CalendarEvent[]
  timeZone?: string
  className?: string
}) {
  if (!guides.length && !events.length) return null

  return (
    <section className={cn("space-y-4", className)}>
      <h2 className="text-xl font-semibold tracking-tight">
        <T>relatedInformation</T>
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((event) => (
          <EventCard key={event.id} event={event} timeZone={timeZone} compact />
        ))}
        {guides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </section>
  )
}
