"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
} from "lucide-react"

import { EmptyState } from "@/components/operations/empty-state"
import { EventCard } from "@/components/operations/event-card"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  eventCategories,
  formatDate,
  formatTime,
  toDateKey,
  type EventCategory,
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
  const monthEvents = published
    .filter((event) => {
      const [year, month] = toDateKey(event.start).split("-").map(Number)
      return (
        year === visibleDate.getFullYear() &&
        month - 1 === visibleDate.getMonth()
      )
    })
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
    <div className="space-y-8">
      <PageHeading
        title="Calendar"
        description="Shared dates for reservations, training, deliveries, visits, and other operational events."
      />
      <div className="flex flex-col gap-4 border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => moveMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleDate(firstOfMonth(dateFromKey(todayKey)))}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => moveMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight />
          </Button>
          <h2 className="ml-2 font-semibold">
            {new Intl.DateTimeFormat("en-GB", {
              month: "long",
              year: "numeric",
            }).format(visibleDate)}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="event-category" className="sr-only">
            Filter by event type
          </label>
          <select
            id="event-category"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as EventCategory | "All")
            }
            className="h-9 border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          >
            <option value="All">All event types</option>
            {eventCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <div className="flex border" aria-label="Calendar view">
            <Button
              variant={view === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
              aria-pressed={view === "month"}
            >
              <CalendarDays /> Month
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List /> List
            </Button>
          </div>
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
                const dayEvents = published.filter(
                  (event) => toDateKey(event.start) === key
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
                            {formatTime(event.start)} {event.title}
                          </span>
                        </Link>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="block px-2 text-xs text-muted-foreground">
                          +{dayEvents.length - 3} more
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
        <div className="space-y-4">
          {monthEvents.map((event) => (
            <Link
              key={event.id}
              href={`/calendar/${event.id}`}
              className="group flex flex-col gap-4 border bg-background p-6 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/30 sm:flex-row sm:items-center"
            >
              <div className="sm:w-40">
                <p className="font-semibold">{formatDate(event.start)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatTime(event.start)}–{formatTime(event.end)}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{event.title}</h3>
                  <Badge variant="secondary">{event.category}</Badge>
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
          title="No events in this view"
          description="Try another month or event type."
        />
      )}

      {view === "month" && monthEvents.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">This month</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {monthEvents.slice(0, 4).map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
