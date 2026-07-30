"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
} from "lucide-react"

import { CalendarExportButton } from "@/components/calendar/calendar-export-button"
import { ManageSectionButton } from "@/components/knowledge-base/manage-section-button"
import { EmptyState } from "@/components/operations/empty-state"
import { EventCard } from "@/components/operations/event-card"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  eventCategoryMessageKeys,
  eventCategories,
  eventLastDateKey,
  eventOccursOnDate,
  formatEventDate,
  formatEventTime,
  formatTime,
  type EventCategory,
  toDateKey,
} from "@/lib/operations"
import { cn } from "@/lib/utils"

type View = "month" | "list"

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function calendarKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function CalendarPage() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { events, hub } = useOperations()
  const todayKey = toDateKey(new Date(), hub?.timeZone)
  const [view, setView] = useState<View>("month")
  const [visibleDate, setVisibleDate] = useState(() =>
    firstOfMonth(dateFromKey(todayKey))
  )
  const [category, setCategory] = useState<EventCategory | "All">("All")
  const published = events.filter(
    (event) =>
      event.published && (category === "All" || event.category === category)
  )
  const allPublished = events.filter((event) => event.published)
  const visibleMonthStart = calendarKey(firstOfMonth(visibleDate))
  const visibleMonthEnd = calendarKey(
    new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 0)
  )
  const monthEvents = published
    .filter(
      (event) =>
        event.start.slice(0, 10) <= visibleMonthEnd &&
        eventLastDateKey(event) >= visibleMonthStart
    )
    .sort((a, b) => a.start.localeCompare(b.start))

  const days = useMemo(() => {
    const first = firstOfMonth(visibleDate)
    const mondayOffset = (first.getDay() + 6) % 7
    const start = new Date(first)
    start.setDate(first.getDate() - mondayOffset)
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [visibleDate])

  function moveMonth(amount: number) {
    setVisibleDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1)
    )
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="calendar"
        description="sharedDatesReservationsTrainingDeliveriesVisitsOtherMessage"
        action={
          <CalendarExportButton
            events={allPublished}
            calendarName={t("namedCalendar", {
              name: hub?.name ?? t("workplace"),
            })}
            timeZone={hub?.timeZone ?? "UTC"}
            uidNamespace={hub?.id ?? "unconfigured-workplace"}
          />
        }
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => moveMonth(-1)}
            aria-label={t("previousMonth")}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleDate(firstOfMonth(dateFromKey(todayKey)))}
          >
            <T>today</T>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => moveMonth(1)}
            aria-label={t("nextMonth")}
          >
            <ChevronRight />
          </Button>
          <h2 className="ml-2 font-semibold">
            {new Intl.DateTimeFormat(languageTag, {
              month: "long",
              year: "numeric",
            }).format(visibleDate)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="event-category" className="sr-only">
            <T>filterByEventType</T>
          </label>
          <Select
            value={category}
            onValueChange={(value) =>
              setCategory(value as EventCategory | "All")
            }
          >
            <SelectTrigger
              id="event-category"
              size="sm"
              className="border border-input bg-background px-3"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">
                <T>allEventTypes</T>
              </SelectItem>
              {eventCategories.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(eventCategoryMessageKeys[item])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SegmentedControl className="h-9" aria-label={t("calendarView")}>
            <SegmentedControlItem
              selected={view === "month"}
              size="sm"
              className="h-full"
              onClick={() => setView("month")}
            >
              <CalendarDays /> <T>month</T>
            </SegmentedControlItem>
            <SegmentedControlItem
              selected={view === "list"}
              size="sm"
              className="h-full"
              onClick={() => setView("list")}
            >
              <List /> <T>list</T>
            </SegmentedControlItem>
          </SegmentedControl>
          <ManageSectionButton
            section="events"
            href="/manager/calendar"
            size="sm"
          />
        </div>
      </div>

      {view === "month" ? (
        <div className="overflow-x-auto border bg-background">
          <div className="min-w-2xl">
            <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="p-3">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = calendarKey(day)
                const dayEvents = published.filter((event) =>
                  eventOccursOnDate(event, key)
                )
                const inMonth = day.getMonth() === visibleDate.getMonth()
                const isToday = key === todayKey
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-28 border-r border-b p-2 last:border-r-0",
                      !inMonth && "bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center text-xs",
                        isToday &&
                          "bg-primary font-semibold text-primary-foreground"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <Link
                          key={event.id}
                          href={`/calendar/${event.id}`}
                          className="block bg-primary/10 px-2 py-1 text-xs font-medium text-foreground hover:bg-primary/20"
                        >
                          <span className="block truncate">
                            {event.allDay ? (
                              <T>allDay</T>
                            ) : (
                              formatTime(
                                event.startUtc ?? event.start,
                                hub?.timeZone,
                                languageTag
                              )
                            )}{" "}
                            {event.title}
                          </span>
                        </Link>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="block px-2 text-xs text-muted-foreground">
                          +{dayEvents.length - 3} <T>moreLowercase</T>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : monthEvents.length ? (
        <div className="space-y-3">
          {monthEvents.map((event) => (
            <Link
              key={event.id}
              href={`/calendar/${event.id}`}
              className="group flex flex-col gap-4 border bg-background p-4 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/30 sm:flex-row sm:items-center"
            >
              <div className="sm:w-40">
                <p className="font-semibold">
                  {formatEventDate(
                    event,
                    undefined,
                    hub?.timeZone,
                    languageTag
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatEventTime(
                    event,
                    hub?.timeZone,
                    languageTag,
                    t("allDay")
                  )}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{event.title}</h3>
                  <Badge variant="secondary">
                    {t(eventCategoryMessageKeys[event.category])}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {event.description}
                </p>
              </div>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="size-4" /> {event.location}
              </span>
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="noEventsInThisView"
          description="tryAnotherMonthOrEventType"
        />
      )}

      {view === "month" && monthEvents.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">
            <T>thisMonth</T>
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {monthEvents.slice(0, 4).map((event) => (
              <EventCard
                key={event.id}
                event={event}
                timeZone={hub?.timeZone}
                compact
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
