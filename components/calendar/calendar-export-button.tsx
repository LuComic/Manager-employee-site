"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { CalendarPlus, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { calendarFileName, serializeICalendar } from "@/lib/icalendar"
import type { CalendarEvent } from "@/lib/operations"

export function CalendarExportButton({
  events,
  calendarName,
  timeZone,
  uidNamespace,
  mode = "calendar",
}: {
  events: CalendarEvent[]
  calendarName: string
  timeZone: string
  uidNamespace: string
  mode?: "calendar" | "event"
}) {
  const t = useAppTranslations()
  const isEvent = mode === "event"
  return (
    <Button
      type="button"
      variant="outline"
      size={isEvent ? "default" : "sm"}
      disabled={!events.length}
      title={t("worksGoogleCalendarAppleCalendarOutlookOtherMessage")}
      onClick={() => {
        const contents = serializeICalendar(events, {
          calendarName,
          timeZone,
          uidNamespace,
        })
        const url = URL.createObjectURL(
          new Blob([contents], { type: "text/calendar;charset=utf-8" })
        )
        const link = document.createElement("a")
        link.href = url
        link.download = calendarFileName(
          isEvent ? (events[0]?.title ?? "event") : calendarName
        )
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
      }}
    >
      {isEvent ? <CalendarPlus /> : <Download />}
      <T>{isEvent ? "addToCalendar" : "exportCalendar"}</T>
    </Button>
  )
}
