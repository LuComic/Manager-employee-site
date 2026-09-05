"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
} from "lucide-react"

import { CalendarExportButton } from "@/components/calendar/calendar-export-button"
import { PrivateEventFilterLabel } from "@/components/calendar/private-event-filter-label"
import { QuickEventDialog } from "@/components/calendar/quick-event-dialog"
import { ManageSectionButton } from "@/components/knowledge-base/manage-section-button"
import { EmptyState } from "@/components/operations/empty-state"
import { EventCard } from "@/components/operations/event-card"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import {
  addCalendarDays,
  eventMatchesFilters,
  eventRenderLastDateKey,
  eventRendersOnDate,
  formatEventDate,
  formatEventTime,
  formatTime,
  PRIVATE_EVENT_FILTER,
  toDateKey,
} from "@/lib/operations"
import { eventCategoryLabel } from "@/lib/categories"
import { cn } from "@/lib/utils"
import {
  eventCategoryColor,
  eventCategoryColorStyles,
} from "@/lib/event-category-colors"

type View = "month" | "list"
type FilterSelection = {
  defaultSelected: boolean
  overrides: Record<string, boolean>
}

const filterCheckboxItemClassName =
  "pr-3 pl-10 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:right-auto [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:left-3 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:size-4 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:border [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:border-input [&_[data-slot=dropdown-menu-checkbox-item-indicator]_svg]:size-3 data-checked:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:border-primary data-checked:[&_[data-slot=dropdown-menu-checkbox-item-indicator]]:bg-primary data-checked:[&_[data-slot=dropdown-menu-checkbox-item-indicator]_svg]:text-white data-checked:[&_[data-slot=dropdown-menu-checkbox-item-indicator]_svg]:stroke-white"

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
  const [categoryFilters, setCategoryFilters] = useState<FilterSelection>({
    defaultSelected: true,
    overrides: {},
  })
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const monthEventsSectionRef = useRef<HTMLElement>(null)
  const allPublished = events.filter((event) => event.published)
  const hasPrivateEvents = allPublished.some((event) => event.isPrivate)
  const filterIds = [
    ...(hasPrivateEvents ? [PRIVATE_EVENT_FILTER] : []),
    ...eventTypes.map((eventType) => eventType.id),
  ]
  const selectedFilterIds = filterIds.filter(
    (filterId) =>
      categoryFilters.overrides[filterId] ?? categoryFilters.defaultSelected
  )
  const allFiltersSelected = selectedFilterIds.length === filterIds.length
  const published = allPublished.filter((event) =>
    eventMatchesFilters(event, selectedFilterIds)
  )
  const visibleMonthStart = calendarKey(firstOfMonth(visibleDate))
  const visibleMonthEnd = calendarKey(
    new Date(visibleDate.getFullYear(), visibleDate.getMonth() + 1, 0)
  )
  const monthEvents = published
    .filter(
      (event) =>
        event.start.slice(0, 10) <= visibleMonthEnd &&
        eventRenderLastDateKey(event) >= visibleMonthStart
    )
    .sort((a, b) => a.start.localeCompare(b.start))
  const selectedDayEvents = selectedDayKey
    ? published
        .filter((event) => eventRendersOnDate(event, selectedDayKey))
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

  function setAllFilters(selected: boolean) {
    setSelectedDayKey(null)
    setCategoryFilters({ defaultSelected: selected, overrides: {} })
  }

  function setFilterSelected(filterId: string, selected: boolean) {
    setSelectedDayKey(null)
    setCategoryFilters((current) => ({
      ...current,
      overrides: { ...current.overrides, [filterId]: selected },
    }))
  }

  function filterLabel(filterId: string) {
    return filterId === PRIVATE_EVENT_FILTER
      ? t("private")
      : eventCategoryLabel(filterId, eventTypes)
  }

  function eventColorStyle(categoryId: string) {
    return eventCategoryColorStyles[eventCategoryColor(categoryId, eventTypes)]
  }

  return (
    <div className="space-y-6">
      <PageHeading
        area="calendar"
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  id="event-category"
                  variant="outline"
                  size="sm"
                  className="w-full justify-between bg-background px-3 sm:w-auto sm:max-w-64"
                  aria-label={t("filterByEventType")}
                />
              }
            >
              <span className="truncate">
                {allFiltersSelected
                  ? t("allEventTypes")
                  : selectedFilterIds.length === 1
                    ? filterLabel(selectedFilterIds[0])
                    : t("selectedEventFilters", {
                        selected: selectedFilterIds.length,
                        total: filterIds.length,
                      })}
              </span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuCheckboxItem
                checked={allFiltersSelected}
                onCheckedChange={setAllFilters}
                className={filterCheckboxItemClassName}
              >
                <T>allEventTypes</T>
              </DropdownMenuCheckboxItem>
              {hasPrivateEvents && (
                <DropdownMenuCheckboxItem
                  checked={selectedFilterIds.includes(PRIVATE_EVENT_FILTER)}
                  onCheckedChange={(selected) =>
                    setFilterSelected(PRIVATE_EVENT_FILTER, selected)
                  }
                  className={filterCheckboxItemClassName}
                >
                  <PrivateEventFilterLabel />
                </DropdownMenuCheckboxItem>
              )}
              {eventTypes.map((eventType) => (
                <DropdownMenuCheckboxItem
                  key={eventType.id}
                  checked={selectedFilterIds.includes(eventType.id)}
                  onCheckedChange={(selected) =>
                    setFilterSelected(eventType.id, selected)
                  }
                  className={filterCheckboxItemClassName}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 rounded-full",
                      eventColorStyle(eventType.id).dot
                    )}
                  />
                  {eventCategoryLabel(eventType.id, eventTypes)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
          <QuickEventDialog
            defaultDate={selectedDayKey ?? addCalendarDays(todayKey, 1)}
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
                  eventRendersOnDate(event, key)
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
                    "cursor-pointer hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
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
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              eventColorStyle(event.category).dot
                            )}
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
                    eventRendersOnDate(event, key)
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
                  return (
                    <div
                      key={key}
                      className={cn(
                        "relative min-h-28 border-r border-b p-2 nth-[7n]:border-r-0",
                        !inMonth && "bg-muted/30 text-muted-foreground"
                      )}
                    >
                      {dayEvents.length > 0 && (
                        <button
                          type="button"
                          className="absolute inset-0 z-0 cursor-pointer hover:bg-muted/50 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
                          aria-label={label}
                          aria-pressed={selectedDayKey === key}
                          aria-controls="calendar-month-events"
                          onClick={() => showEventsForDay(key)}
                        />
                      )}
                      <span
                        className={cn(
                          "pointer-events-none relative z-10 flex size-7 items-center justify-center text-xs",
                          isToday &&
                            "bg-primary font-semibold text-primary-foreground"
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <div className="pointer-events-none relative z-10 mt-2 space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const continuesFromPreviousDay =
                            dayIndex % 7 !== 0 && event.start.slice(0, 10) < key
                          const continuesIntoNextDay =
                            dayIndex % 7 !== 6 &&
                            eventRenderLastDateKey(event) > key

                          // Bridge the cell's 8px inset while leaving the 1px
                          // day divider visible between event segments.
                          return (
                            <Link
                              key={event.id}
                              href={`/calendar/${event.id}`}
                              className={cn(
                                "pointer-events-auto relative z-10 block px-2 py-1 text-xs font-medium",
                                eventColorStyle(event.category).soft,
                                eventColorStyle(event.category).hover,
                                continuesFromPreviousDay && "-ml-2 pl-4",
                                continuesIntoNextDay && "-mr-2 pr-4"
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
              className={cn(
                "group flex flex-col gap-4 border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:flex-row sm:items-center",
                "border-l-2 bg-background",
                eventColorStyle(event.category).rail,
                eventColorStyle(event.category).hover
              )}
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
                  <Badge className={eventColorStyle(event.category).soft}>
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
          area="calendar"
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
