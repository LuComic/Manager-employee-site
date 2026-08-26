"use client"

import { useMemo, useState } from "react"
import { CalendarClock, MapPin } from "lucide-react"
import { useQuery } from "convex/react"

import { ManagerFilterPanel } from "@/components/manager/manager-filter-panel"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { T } from "@/components/translated-text"
import { api } from "@/convex/_generated/api"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"

export function ScheduleManager() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  const [worker, setWorker] = useState("all")
  const schedules = useQuery(
    api.schedules.listForManager,
    hub ? { hubId: hub.id } : "skip"
  )
  const workers = useMemo(() => {
    const unique = new Map<string, string>()
    for (const schedule of schedules ?? []) {
      unique.set(
        schedule.employeeId ?? schedule.employeeName,
        schedule.employeeName
      )
    }
    return [...unique.entries()].sort((left, right) =>
      left[1].localeCompare(right[1])
    )
  }, [schedules])
  const visibleSchedules = (schedules ?? []).filter(
    (schedule) =>
      worker === "all" ||
      (schedule.employeeId ?? schedule.employeeName) === worker
  )
  const grouped = new Map<string, NonNullable<typeof schedules>>()
  for (const schedule of visibleSchedules) {
    const key = schedule.start.slice(0, 10)
    grouped.set(key, [...(grouped.get(key) ?? []), schedule])
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="schedules"
        description="reviewDeputySchedulesSeparateFromEvents"
      />
      {schedules !== undefined && schedules.length > 0 && (
        <ManagerFilterPanel>
          <Select
            value={worker}
            onValueChange={(value) => setWorker(value ?? "all")}
          >
            <SelectTrigger
              className="w-full border border-input bg-background px-3 sm:max-w-sm"
              aria-label={t("filterSchedulesByWorker")}
            >
              <SelectValue>
                {worker === "all"
                  ? t("all")
                  : workers.find(([id]) => id === worker)?.[1]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <T>all</T>
              </SelectItem>
              {workers.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ManagerFilterPanel>
      )}
      {schedules === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          <T>loadingSchedules</T>
        </p>
      ) : visibleSchedules.length ? (
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
                    summaryHref={
                      schedule.published
                        ? `/calendar/${schedule.slug}`
                        : undefined
                    }
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
