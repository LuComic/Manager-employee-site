"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
} from "lucide-react"

import { CalendarExportButton } from "@/components/calendar/calendar-export-button"
import {
  CreateSectionButton,
  ManageSectionButton,
} from "@/components/knowledge-base/manage-section-button"
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
  eventLastDateKey,
  eventOccursOnDate,
  formatEventDate,
  formatEventTime,
  formatTime,
  toDateKey,
} from "@/lib/operations"
import { eventCategoryLabel } from "@/lib/categories"
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
  const { events, eventTypes, hub } = useOperations()
  const todayKey = toDateKey(new Date(), hub?.timeZone)
  const [view, setView] = useState<View>("month")
  const [visibleDate, setVisibleDate] = useState(() =>
    firstOfMonth(dateFromKey(todayKey))
  )
  const [category, setCategory] = useState<string>("All")
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const monthEventsSectionRef = useRef<HTMLElement>(null)
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
  const selectedDayEvents = selectedDayKey
    ? published
        .filter((event) => eventOccursOnDate(event, selectedDayKey))
        .sort((a, b) => a.start.localeCompare(b.start))
    : []
  const summaryEvents = selectedDayEvents.length
    ? selectedDayEvents
    : monthEvents.slice(0, 4)

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

  useEffect(() => {
    if (!selectedDayKey) return
    const frame = window.requestAnimationFrame(() => {
      monthEventsSectionRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedDayKey])

  function moveMonth(amount: number) {
    setSelectedDayKey(null)
    setVisibleDate(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1)
    )
  }

  function showEventsForDay(key: string) {
    if (selectedDayKey === key) {
      monthEventsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
      return
    }
    setSelectedDayKey(key)
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="order-first w-full font-semibold sm:order-none sm:mr-2 sm:w-auto">
            {new Intl.DateTimeFormat(languageTag, {
              month: "long",
              year: "numeric",
            }).format(visibleDate)}
          </h2>
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
            onClick={() => {
              setSelectedDayKey(null)
              setVisibleDate(firstOfMonth(dateFromKey(todayKey)))
            }}
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
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label htmlFor="event-category" className="sr-only">
            <T>filterByEventType</T>
          </label>
          <Select
            value={category}
            onValueChange={(value) => {
              if (value) {
                setSelectedDayKey(null)
                setCategory(value)
              }
            }}
          >
            <SelectTrigger
              id="event-category"
              size="sm"
              className="w-full border border-input bg-background px-3 sm:w-auto sm:max-w-64"
            >
              <SelectValue>
                {category === "All"
                  ? t("allEventTypes")
                  : eventCategoryLabel(category, eventTypes)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">
                <T>allEventTypes</T>
              </SelectItem>
              {eventTypes.map((eventType) => (
                <SelectItem key={eventType.id} value={eventType.id}>
                  {eventCategoryLabel(eventType.id, eventTypes)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SegmentedControl className="h-9" aria-label={t("calendarView")}>
            <SegmentedControlItem
              selected={view === "month"}
              size="sm"
              className="h-full min-h-0"
              onClick={() => setView("month")}
            >
              <CalendarDays /> <T>month</T>
            </SegmentedControlItem>
            <SegmentedControlItem
              selected={view === "list"}
              size="sm"
              className="h-full min-h-0"
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
          <CreateSectionButton
            section="events"
            href="/manager/calendar/new"
            label="createEvent"
          />
        </div>
      </div>

      {view === "month" ? (
        <>
          <div className="border border-b-0 bg-background md:hidden">
            <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[0.6875rem] font-semibold text-muted-foreground">
              {days.slice(0, 7).map((day) => (
                <div key={calendarKey(day)} className="py-2">
                  {new Intl.DateTimeFormat(languageTag, {
                    weekday: "narrow",
                  }).format(day)}
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
                const label = [
                  new Intl.DateTimeFormat(languageTag, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(day),
                  ...dayEvents.map((event) => event.title),
                ].join(", ")
                const cellClassName = cn(
                  "flex min-h-14 min-w-0 flex-col items-center border-r border-b px-0.5 py-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  dayEvents.length > 0 &&
                    "cursor-pointer hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                  selectedDayKey === key &&
                    "bg-primary/10 ring-2 ring-primary ring-inset"
                )
                const content = (
                  <>
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center text-xs",
                        isToday &&
                          "bg-primary font-semibold text-primary-foreground"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span
                        className="mt-1 flex max-w-full items-center justify-center gap-0.5"
                        aria-hidden="true"
                      >
                        {dayEvents.slice(0, 3).map((event) => (
                          <span
                            key={event.id}
                            className="size-1.5 shrink-0 rounded-full bg-primary"
                          />
                        ))}
                      </span>
                    )}
                  </>
                )
                return dayEvents.length > 0 ? (
                  <button
                    key={key}
                    type="button"
                    className={cellClassName}
                    aria-label={label}
                    aria-pressed={selectedDayKey === key}
                    aria-controls="calendar-month-events"
                    onClick={() => showEventsForDay(key)}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={key} className={cellClassName} aria-label={label}>
                    {content}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="hidden overflow-x-auto border border-b-0 bg-background md:block">
            <div className="min-w-2xl">
              <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
                {days.slice(0, 7).map((day) => (
                  <div key={calendarKey(day)} className="p-3">
                    {new Intl.DateTimeFormat(languageTag, {
                      weekday: "short",
                    }).format(day)}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, dayIndex) => {
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
                        "min-h-28 border-r border-b p-2 nth-[7n]:border-r-0",
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
                        {dayEvents.slice(0, 3).map((event) => {
                          const continuesFromPreviousDay =
                            dayIndex % 7 !== 0 && event.start.slice(0, 10) < key
                          const continuesIntoNextDay =
                            dayIndex % 7 !== 6 && eventLastDateKey(event) > key

                          // Bridge the cell's 8px inset and 1px border while
                          // preserving the label inset within each calendar row.
                          return (
                            <Link
                              key={event.id}
                              href={`/calendar/${event.id}`}
                              className={cn(
                                "relative z-10 block bg-primary/10 px-2 py-1 text-xs font-medium text-foreground hover:bg-primary/20",
                                continuesFromPreviousDay && "-ml-2 pl-4",
                                continuesIntoNextDay && "-mr-2.25 pr-4.25"
                              )}
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
                          )
                        })}
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
        </>
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
                    {eventCategoryLabel(event.category, eventTypes)}
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

      {view === "month" && summaryEvents.length > 0 && (
        <section
          id="calendar-month-events"
          ref={monthEventsSectionRef}
          className="scroll-mt-24"
        >
          <h2 className="mb-4 text-xl font-semibold">
            {selectedDayKey && selectedDayEvents.length ? (
              new Intl.DateTimeFormat(languageTag, {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(dateFromKey(selectedDayKey))
            ) : (
              <T>thisMonth</T>
            )}
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {summaryEvents.map((event) => (
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
