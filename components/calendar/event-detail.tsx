"use client"

import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  FileText,
  MapPin,
  UsersRound,
} from "lucide-react"

import { CalendarExportButton } from "@/components/calendar/calendar-export-button"
import { EmptyState } from "@/components/operations/empty-state"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatEventDate, formatEventTime } from "@/lib/operations"
import { cn } from "@/lib/utils"

export function EventDetail({ eventId }: { eventId: string }) {
  const { events, guides, hub } = useOperations()
  const event = events.find((item) => item.id === eventId && item.published)
  if (!event)
    return (
      <EmptyState
        icon={CalendarDays}
        title="Event not available"
        description="This event may be unpublished or removed. Return to the calendar for current events."
      />
    )
  const relatedGuides = guides.filter(
    (guide) => guide.published && event.guideIds.includes(guide.id)
  )

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/calendar"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "tracking-normal normal-case"
        )}
      >
        <ArrowLeft /> Back to calendar
      </Link>
      <Card className="shadow-none">
        <CardHeader className="border-b">
          <Badge variant="secondary">{event.category}</Badge>
          <CardTitle>
            <h1 className="text-2xl tracking-tight">{event.title}</h1>
          </CardTitle>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {event.description}
          </p>
          <CardAction className="hidden sm:block">
            <CalendarExportButton
              events={[event]}
              calendarName={`${hub?.name ?? "Workplace"} calendar`}
              timeZone={hub?.timeZone ?? "UTC"}
              mode="event"
            />
          </CardAction>
          <div className="mt-4 sm:hidden">
            <CalendarExportButton
              events={[event]}
              calendarName={`${hub?.name ?? "Workplace"} calendar`}
              timeZone={hub?.timeZone ?? "UTC"}
              mode="event"
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail
            icon={CalendarDays}
            label="Date"
            value={formatEventDate(
              event,
              {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              },
              hub?.timeZone
            )}
          />
          <Detail
            icon={Clock3}
            label="Time"
            value={formatEventTime(event, hub?.timeZone)}
          />
          <Detail icon={MapPin} label="Location" value={event.location} />
          <Detail
            icon={UsersRound}
            label="Employees"
            value={
              event.employees.length
                ? event.employees
                    .map((employee) => employee.displayName)
                    .join(", ")
                : "No employees assigned"
            }
          />
          <div className="border-t pt-4 sm:col-span-2">
            <h2 className="font-semibold">Notes</h2>
            <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
              {event.notes || "No additional notes."}
            </p>
          </div>
          <div className="border-t pt-4 sm:col-span-2">
            <h2 className="font-semibold">Attachments</h2>
            {event.attachments.length ? (
              <ul className="mt-4 space-y-2">
                {event.attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <FileText className="size-4 text-primary" />
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-4 hover:text-primary"
                    >
                      {attachment.name}
                    </a>
                    <Badge variant="secondary">
                      {Math.max(1, Math.round(attachment.size / 1024))} KB
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No attachments for this event.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      {relatedGuides.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Related guides</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatedGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays
  label: string
  value: string
}) {
  return (
    <div className="flex gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
