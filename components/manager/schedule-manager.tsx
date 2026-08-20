"use client"

import { CalendarClock, MapPin } from "lucide-react"
import { useQuery } from "convex/react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { T } from "@/components/translated-text"
import { api } from "@/convex/_generated/api"
import { useLanguageTag } from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"

export function ScheduleManager() {
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  const schedules = useQuery(
    api.schedules.listForManager,
    hub ? { hubId: hub.id } : "skip"
  )
  const grouped = new Map<string, NonNullable<typeof schedules>>()
  for (const schedule of schedules ?? []) {
    const key = schedule.start.slice(0, 10)
    grouped.set(key, [...(grouped.get(key) ?? []), schedule])
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="schedules"
        description="reviewDeputySchedulesSeparateFromEvents"
      />
      {schedules === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          <T>loadingSchedules</T>
        </p>
      ) : schedules.length ? (
        <div className="space-y-7">
          {[...grouped.entries()].map(([date, items]) => (
            <section key={date} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {formatDate(
                  `${date}T00:00`,
                  { weekday: "long", day: "numeric", month: "long" },
                  hub?.timeZone,
                  languageTag
                )}
              </h2>
              <div className="space-y-3">
                {items.map((schedule) => (
                  <ManagerListItem
                    key={schedule.id}
                    icon={<CalendarClock className="size-5" />}
                    title={schedule.employeeName}
                    metadata={[
                      <Badge key="time" variant="secondary">
                        {formatTime(schedule.start, hub?.timeZone, languageTag)}
                        {" – "}
                        {formatTime(schedule.end, hub?.timeZone, languageTag)}
                      </Badge>,
                    ]}
                    description={
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {schedule.area}
                      </span>
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="noSchedulesAvailable"
          description="deputySchedulesAppearAfterSync"
        />
      )}
    </div>
  )
}
