"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { useState } from "react"
import { enGB, et } from "date-fns/locale"
import { ArrowLeft, CalendarDays, Paperclip, Trash2, Users } from "lucide-react"

import { RelatedGuidesPicker } from "@/components/manager/related-guides-picker"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { AppMessageKey } from "@/i18n/messages"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { eventCategoryLabel, RESERVATION_EVENT_TYPE_ID } from "@/lib/categories"
import {
  addCalendarDays,
  addHoursToLocalDateTime,
  slugify,
  toLocalDateTimeValue,
  type CalendarEvent,
} from "@/lib/operations"

function cloneEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    attachments: [...event.attachments],
    employees: [...event.employees],
    guideIds: [...event.guideIds],
  }
}

function newEvent(
  location = "",
  category = RESERVATION_EVENT_TYPE_ID
): CalendarEvent {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(11, 0)
  return {
    id: "",
    title: "",
    description: "",
    category,
    start: toLocalDateTimeValue(start),
    end: toLocalDateTimeValue(end),
    allDay: false,
    location,
    employees: [],
    notes: "",
    attachments: [],
    guideIds: [],
    published: true,
  }
}

export function EventEditor({ eventId }: { eventId?: string }) {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const {
    events,
    eventTypes,
    employees,
    guideReferences,
    hub,
    saveEvent,
    uploadAttachment,
    deleteAttachment,
    showFeedback,
  } = useOperations()
  const existing = eventId
    ? events.find((event) => event.id === eventId)
    : undefined
  const [draft, setDraft] = useState<CalendarEvent | null>(() =>
    eventId
      ? existing
        ? cloneEvent(existing)
        : null
      : newEvent(hub?.address ?? "", eventTypes[0]?.id)
  )
  const [endWasEdited, setEndWasEdited] = useState(Boolean(eventId))
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [removedAttachments, setRemovedAttachments] = useState<
    CalendarEvent["attachments"]
  >([])
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const { leaveWithoutPrompt, requestLeave } = useUnsavedChanges({
    dirty,
    itemName: "event",
    toastId: "discard-event-changes",
    onDiscard: () => setDirty(false),
  })

  function change(next: CalendarEvent) {
    setDraft(next)
    setDirty(true)
    setError("")
  }

  function changeTimedStart(value: string) {
    if (!draft) return
    const suggestedEnd = addHoursToLocalDateTime(value, 1)
    const end = !endWasEdited && suggestedEnd ? suggestedEnd : draft.end
    if (value === draft.start && end === draft.end) return
    change(
      clearEventInstants({
        ...draft,
        start: value,
        end,
      })
    )
  }

  function changeTimedEnd(value: string) {
    if (!draft) return
    setEndWasEdited(true)
    change(clearEventInstants({ ...draft, end: value }))
  }

  function leave() {
    requestLeave("/manager/calendar")
  }

  async function submit() {
    if (!draft) return
    if (
      !draft.title.trim() ||
      !draft.description.trim() ||
      !draft.location.trim()
    ) {
      return setError("addATitleDescriptionAndLocation")
    }
    if (
      !isCompleteLocalDateTime(draft.start) ||
      !isCompleteLocalDateTime(draft.end)
    ) {
      return setError("addStartEndDateTime")
    }
    if (!eventEndsAfterStart(draft)) {
      return setError("endLaterThanStart")
    }

    let id = draft.id
    if (!id) {
      const base = slugify(draft.title) || "event"
      id = base
      let suffix = 2
      while (events.some((event) => event.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }

    setSaving(true)
    try {
      const eventSlug = await saveEvent({
        ...draft,
        id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        location: draft.location.trim(),
        notes: draft.notes.trim(),
      })
      for (const attachment of removedAttachments) {
        await deleteAttachment(attachment)
      }
      for (const file of pendingFiles) {
        await uploadAttachment(eventSlug, file)
      }
      setDirty(false)
      showFeedback(draft.id ? "eventSaved" : "eventCreated")
      leaveWithoutPrompt("/manager/calendar")
    } finally {
      setSaving(false)
    }
  }

  if (!draft) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="eventNotFound"
        description="eventRemovedCurrentWorkplace"
        actionLabel="backToCalendarEvents"
        actionHref="/manager/calendar"
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={leave}>
          <ArrowLeft /> <T>backToCalendarEvents</T>
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          <T>{draft.id ? "editEvent" : "createEvent"}</T>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <T>addEventDetailsChooseWhoRelatesControlMessage</T>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                <T>details</T>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="title" id="event-title">
                <Input
                  id="event-title"
                  value={draft.title}
                  onChange={(event) =>
                    change({ ...draft, title: event.target.value })
                  }
                  className="border border-input px-3 text-base"
                />
              </Field>
              <Field label="description" id="event-description">
                <Textarea
                  id="event-description"
                  value={draft.description}
                  onChange={(event) =>
                    change({ ...draft, description: event.target.value })
                  }
                  className="min-h-24 border border-input px-3"
                />
              </Field>
              <Field label="location" id="event-location">
                <Input
                  id="event-location"
                  value={draft.location}
                  onChange={(event) =>
                    change({ ...draft, location: event.target.value })
                  }
                  className="border border-input px-3"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                <T>schedule</T>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.allDay}
                  onChange={(event) =>
                    change(toggleAllDayEvent(draft, event.target.checked))
                  }
                />
                <T>allDayEvent</T>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={draft.allDay ? "startDate" : "starts"}
                  id="event-start"
                >
                  <EventDatePicker
                    id="event-start"
                    value={draft.start.slice(0, 10)}
                    languageTag={languageTag}
                    ariaLabel={t(draft.allDay ? "startDate" : "starts")}
                    onChange={(value) => {
                      if (draft.allDay) {
                        change(updateAllDayStart(draft, value))
                      } else {
                        changeTimedStart(replaceLocalDate(draft.start, value))
                      }
                    }}
                  />
                  {!draft.allDay && (
                    <>
                      <Label htmlFor="event-start-time" className="sr-only">
                        <T>starts</T> <T>time</T>
                      </Label>
                      <Input
                        id="event-start-time"
                        type="time"
                        value={localTime(draft.start)}
                        aria-label={`${t("starts")} ${t("time")}`}
                        onChange={(event) =>
                          changeTimedStart(
                            replaceLocalTime(draft.start, event.target.value)
                          )
                        }
                        onBlur={(event) =>
                          changeTimedStart(
                            replaceLocalTime(draft.start, event.target.value)
                          )
                        }
                        className="mt-2 border border-input px-3"
                      />
                    </>
                  )}
                </Field>
                <Field label={draft.allDay ? "lastDay" : "ends"} id="event-end">
                  <EventDatePicker
                    id="event-end"
                    value={
                      draft.allDay
                        ? addCalendarDays(draft.end.slice(0, 10), -1)
                        : draft.end.slice(0, 10)
                    }
                    minimum={
                      draft.allDay ? draft.start.slice(0, 10) : undefined
                    }
                    languageTag={languageTag}
                    ariaLabel={t(draft.allDay ? "lastDay" : "ends")}
                    onChange={(value) => {
                      if (draft.allDay) {
                        change({
                          ...draft,
                          end: `${addCalendarDays(value, 1)}T00:00`,
                        })
                      } else {
                        changeTimedEnd(replaceLocalDate(draft.end, value))
                      }
                    }}
                  />
                  {!draft.allDay && (
                    <>
                      <Label htmlFor="event-end-time" className="sr-only">
                        <T>ends</T> <T>time</T>
                      </Label>
                      <Input
                        id="event-end-time"
                        type="time"
                        value={localTime(draft.end)}
                        aria-label={`${t("ends")} ${t("time")}`}
                        onChange={(event) =>
                          changeTimedEnd(
                            replaceLocalTime(draft.end, event.target.value)
                          )
                        }
                        className="mt-2 border border-input px-3"
                      />
                    </>
                  )}
                </Field>
              </div>
              {draft.allDay && (
                <p className="text-xs text-muted-foreground">
                  <T>allDayEventsRemainAllDayImportedMessage</T>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> <T>relatedEmployees</T>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex flex-wrap gap-2"
                aria-label={t("selectEmployees")}
              >
                {employees
                  .filter(
                    (employee) =>
                      employee.status !== "deactivated" ||
                      draft.employees.some(
                        (selected) => selected.id === employee.id
                      )
                  )
                  .map((employee) => {
                    const selected = draft.employees.some(
                      (item) => item.id === employee.id
                    )
                    return (
                      <Button
                        key={employee.id}
                        type="button"
                        size="xs"
                        variant={selected ? "default" : "outline"}
                        className={selected ? undefined : "bg-background"}
                        aria-pressed={selected}
                        onClick={() =>
                          change({
                            ...draft,
                            employees: selected
                              ? draft.employees.filter(
                                  (item) => item.id !== employee.id
                                )
                              : [
                                  ...draft.employees,
                                  {
                                    id: employee.id,
                                    displayName: employee.displayName,
                                  },
                                ],
                          })
                        }
                      >
                        {employee.displayName}
                      </Button>
                    )
                  })}
                {!employees.length && (
                  <p className="text-sm text-muted-foreground">
                    <T>createEmployeeProfilesFirstSaveEventWithoutMessage</T>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Paperclip className="size-4" /> <T>attachments</T>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="addFiles" id="event-attachments">
                <Input
                  id="event-attachments"
                  type="file"
                  multiple
                  onChange={(event) => {
                    setPendingFiles(Array.from(event.target.files ?? []))
                    setDirty(true)
                    setError("")
                  }}
                  className="border border-input px-3"
                />
              </Field>
              {(draft.attachments.length > 0 || pendingFiles.length > 0) && (
                <ul className="space-y-2 border p-3 text-sm">
                  {draft.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip className="size-4 shrink-0" />
                        <span className="truncate">{attachment.name}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("removeName", {
                          name: attachment.name,
                        })}
                        onClick={() => {
                          setRemovedAttachments([
                            ...removedAttachments,
                            attachment,
                          ])
                          change({
                            ...draft,
                            attachments: draft.attachments.filter(
                              (item) => item.id !== attachment.id
                            ),
                          })
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                  {pendingFiles.map((file) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <Paperclip className="size-4" />
                      <span>{file.name}</span>
                      <span>
                        <T>uploadsOnSave</T>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit shadow-none">
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) =>
                    change({ ...draft, published: event.target.checked })
                  }
                />
                <T>publishNow</T>
              </label>
              <Field label="eventType" id="event-type">
                <Select
                  value={draft.category}
                  onValueChange={(value) => {
                    if (value) change({ ...draft, category: value })
                  }}
                >
                  <SelectTrigger
                    id="event-type"
                    className="w-full border border-input bg-background px-3"
                  >
                    <SelectValue>
                      {eventCategoryLabel(draft.category, eventTypes)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map((eventType) => (
                      <SelectItem key={eventType.id} value={eventType.id}>
                        {eventCategoryLabel(eventType.id, eventTypes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <RelatedGuidesPicker
              guides={guideReferences}
              selectedIds={draft.guideIds}
              onChange={(guideIds) => change({ ...draft, guideIds })}
            />

            <section className="space-y-4">
              <Field label="managerNotes" id="event-notes">
                <Textarea
                  id="event-notes"
                  value={draft.notes}
                  onChange={(event) =>
                    change({ ...draft, notes: event.target.value })
                  }
                  className="min-h-32 border border-input px-3"
                />
              </Field>
            </section>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              <T>{error}</T>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <T>{dirty ? "unsavedChanges" : "noUnsavedChanges"}</T>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={leave}>
            <T>cancel</T>
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            <T>{saving ? "saving" : "saveEvent"}</T>
          </Button>
        </div>
      </div>
    </div>
  )
}

function EventDatePicker({
  id,
  value,
  minimum,
  languageTag,
  ariaLabel,
  onChange,
}: {
  id: string
  value: string
  minimum?: string
  languageTag: string
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = localDate(value)
  const minimumDate = minimum ? localDate(minimum) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full justify-start bg-background px-3 font-normal"
            aria-label={ariaLabel}
          />
        }
      >
        <CalendarDays />
        {selected
          ? new Intl.DateTimeFormat(languageTag, {
              dateStyle: "medium",
            }).format(selected)
          : ariaLabel}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          locale={languageTag === "et-EE" ? et : enGB}
          disabled={minimumDate ? { before: minimumDate } : undefined}
          onSelect={(date) => {
            if (!date) return
            onChange(localDateKey(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

function localDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const result = new Date(year, month - 1, day)
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return undefined
  }
  return result
}

function localDateKey(value: Date) {
  const year = String(value.getFullYear()).padStart(4, "0")
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function localTime(value: string) {
  const time = value.slice(11, 16)
  return /^\d{2}:\d{2}$/.test(time) ? time : ""
}

function replaceLocalDate(value: string, date: string) {
  return `${date}T${localTime(value)}`
}

function replaceLocalTime(value: string, time: string) {
  return `${value.slice(0, 10)}T${time}`
}

function isCompleteLocalDateTime(value: string) {
  return Boolean(addHoursToLocalDateTime(value, 0))
}

function eventEndsAfterStart(event: CalendarEvent) {
  if (event.startUtc && event.endUtc) {
    const start = new Date(event.startUtc).getTime()
    const end = new Date(event.endUtc).getTime()
    if (!Number.isNaN(start) && !Number.isNaN(end)) return end > start
  }
  return event.end > event.start
}

function clearEventInstants(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    startUtc: undefined,
    endUtc: undefined,
  }
}

function toggleAllDayEvent(
  event: CalendarEvent,
  allDay: boolean
): CalendarEvent {
  const startDate = event.start.slice(0, 10)
  const endDate = event.end.slice(0, 10)

  if (allDay) {
    const lastDay = endDate >= startDate ? endDate : startDate
    return {
      ...clearEventInstants(event),
      allDay: true,
      start: `${startDate}T00:00`,
      end: `${addCalendarDays(lastDay, 1)}T00:00`,
    }
  }

  const lastDay = addCalendarDays(endDate, -1)
  return {
    ...clearEventInstants(event),
    allDay: false,
    start: `${startDate}T09:00`,
    end: lastDay > startDate ? `${lastDay}T17:00` : `${startDate}T10:00`,
  }
}

function updateAllDayStart(event: CalendarEvent, value: string): CalendarEvent {
  if (!value) return { ...clearEventInstants(event), start: "" }
  const minimumEnd = `${addCalendarDays(value, 1)}T00:00`
  return {
    ...clearEventInstants(event),
    start: `${value}T00:00`,
    end: event.end > `${value}T00:00` ? event.end : minimumEnd,
  }
}

function Field({
  label,
  id,
  children,
}: {
  label: AppMessageKey
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <T>{label}</T>
      </Label>
      {children}
    </div>
  )
}
