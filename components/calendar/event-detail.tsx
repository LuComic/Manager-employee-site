"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
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
import { RelatedInformation } from "@/components/operations/related-information"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { AppMessageKey } from "@/i18n/messages"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatEventDate, formatEventTime } from "@/lib/operations"
import { eventCategoryLabel } from "@/lib/categories"
import { cn } from "@/lib/utils"

export function EventDetail({ eventId }: { eventId: string }) {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { events, eventTypes, guides, hub } = useOperations()
  const event = events.find((item) => item.id === eventId && item.published)
  if (!event)
    return (
      <EmptyState
        icon={CalendarDays}
        title="eventNotAvailable"
        description="eventUnpublishedRemovedReturnCalendarCurrentEvents"
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
        <ArrowLeft data-icon="inline-start" /> <T>backToCalendar</T>
      </Link>
      <Card className="shadow-none">
        <CardHeader className="border-b">
          <Badge variant="secondary">
            {eventCategoryLabel(event.category, eventTypes)}
          </Badge>
          <CardTitle>
            <h1 className="text-2xl tracking-tight">{event.title}</h1>
          </CardTitle>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {event.description}
          </p>
          <CardAction className="hidden sm:block">
            <CalendarExportButton
              events={[event]}
              calendarName={t("namedCalendar", {
                name: hub?.name ?? t("workplace"),
              })}
              timeZone={hub?.timeZone ?? "UTC"}
              uidNamespace={hub?.id ?? "unconfigured-workplace"}
              mode="event"
            />
          </CardAction>
          <div className="mt-4 sm:hidden">
            <CalendarExportButton
              events={[event]}
              calendarName={t("namedCalendar", {
                name: hub?.name ?? t("workplace"),
              })}
              timeZone={hub?.timeZone ?? "UTC"}
              uidNamespace={hub?.id ?? "unconfigured-workplace"}
              mode="event"
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail
            icon={CalendarDays}
            label="date"
            value={formatEventDate(
              event,
              {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              },
              hub?.timeZone,
              languageTag
            )}
          />
          <Detail
            icon={Clock3}
            label="time"
            value={
              event.allDay
                ? t("allDay")
                : formatEventTime(
                    event,
                    hub?.timeZone,
                    languageTag,
                    t("allDay")
                  )
            }
          />
          <Detail icon={MapPin} label="location" value={event.location} />
          <Detail
            icon={UsersRound}
            label="employees"
            value={
              event.employees.length
                ? event.employees
                    .map((employee) => employee.displayName)
                    .join(", ")
                : t("noEmployeesAssigned")
            }
          />
          <div className="border-t pt-4 sm:col-span-2">
            <h2 className="font-semibold">
              <T>notes</T>
            </h2>
            <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
              {event.notes || t("noAdditionalNotes")}
            </p>
          </div>
          <div className="border-t pt-4 sm:col-span-2">
            <h2 className="font-semibold">
              <T>attachments</T>
            </h2>
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
                      {Math.max(1, Math.round(attachment.size / 1024))}{" "}
                      <T>kilobyteAbbreviation</T>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                <T>noAttachmentsForThisEvent</T>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <RelatedInformation guides={relatedGuides} timeZone={hub?.timeZone} />
    </article>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays
  label: AppMessageKey
  value: string
}) {
  return (
    <div className="flex gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">
          <T>{label}</T>
        </p>
        <p className="mt-1 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
