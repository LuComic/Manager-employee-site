"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { useState } from "react"
import {
  ArrowLeft,
  CalendarDays,
  Paperclip,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react"

import {
  EventDatePicker,
  EventDateTimePicker,
} from "@/components/calendar/event-date-time-picker"
import { RelatedGuidesPicker } from "@/components/manager/related-guides-picker"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  quickEventDraftToCalendarEvent,
  takeQuickEventDraft,
  type QuickEventDraft,
} from "@/lib/quick-event-draft"

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
  category = RESERVATION_EVENT_TYPE_ID,
  quickDraft?: QuickEventDraft | null
): CalendarEvent {
  if (quickDraft) {
    return quickEventDraftToCalendarEvent(quickDraft, {
      id: "",
      category,
      location,
    })
  }
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
    isPrivate: false,
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
    managerAccess,
    saveEvent,
    uploadAttachment,
    deleteAttachment,
    showFeedback,
  } = useOperations()
  const existing = eventId
    ? events.find((event) => event.id === eventId)
    : undefined
  const [quickDraft] = useState(() =>
    eventId || !hub ? null : takeQuickEventDraft(hub.id)
  )
  const [draft, setDraft] = useState<CalendarEvent | null>(() =>
    eventId
      ? existing
        ? cloneEvent(existing)
        : null
      : newEvent(hub?.address ?? "", eventTypes[0]?.id, quickDraft)
  )
  const [endDateWasEdited, setEndDateWasEdited] = useState(Boolean(eventId))
  const [endTimeWasEdited, setEndTimeWasEdited] = useState(Boolean(eventId))
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [removedAttachments, setRemovedAttachments] = useState<
    CalendarEvent["attachments"]
  >([])
  const [dirty, setDirty] = useState(Boolean(quickDraft))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const deputyManaged = draft?.source === "deputy"
  const canManagePrivacy =
    managerAccess === "manager" || managerAccess === "owner"
  const canSaveDraft = Boolean(
    draft &&
    draft.title.trim() &&
    draft.description.trim() &&
    draft.location.trim() &&
    isCompleteLocalDateTime(draft.start) &&
    isCompleteLocalDateTime(draft.end) &&
    eventEndsAfterStart(draft)
  )
  const { leaveWithoutPrompt, requestLeave } = useUnsavedChanges({
    dirty,
    itemName: "event",
    toastId: "discard-event-changes",
    onDiscard: () => setDirty(false),
    onSaveDraft: deputyManaged || !canSaveDraft ? undefined : () => save(true),
  })

  function change(next: CalendarEvent) {
    setDraft(next)
    setDirty(true)
    setError("")
  }

  function changeTimedStart(value: string) {
    if (!draft) return
    const suggestedEnd = addHoursToLocalDateTime(value, 1)
    let end = suggestedEnd || draft.end
    if (suggestedEnd && endDateWasEdited) {
      end = replaceLocalDate(end, draft.end.slice(0, 10))
    }
    if (suggestedEnd && endTimeWasEdited) {
      end = replaceLocalTime(end, localTime(draft.end))
    }
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
    setEndTimeWasEdited(true)
    change(clearEventInstants({ ...draft, end: value }))
  }

  function leave() {
    requestLeave("/manager/calendar")
  }

  async function save(asDraft = false) {
    if (!draft) return false
    if (
      !draft.title.trim() ||
      !draft.description.trim() ||
      !draft.location.trim()
    ) {
      setError("addATitleDescriptionAndLocation")
      return false
    }
    if (
      !isCompleteLocalDateTime(draft.start) ||
      !isCompleteLocalDateTime(draft.end)
    ) {
      setError("addStartEndDateTime")
      return false
    }
    if (!eventEndsAfterStart(draft)) {
      setError("endLaterThanStart")
      return false
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
        published: asDraft ? false : draft.published,
      })
      for (const attachment of removedAttachments) {
        await deleteAttachment(attachment)
      }
      for (const file of pendingFiles) {
        await uploadAttachment(eventSlug, file)
      }
      setDirty(false)
      showFeedback(
        asDraft ? "savedAsDraft" : draft.id ? "eventSaved" : "eventCreated"
      )
      return true
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (await save()) leaveWithoutPrompt("/manager/calendar")
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
              {deputyManaged && (
                <div className="border bg-muted/40 p-3 text-sm">
                  <p className="font-semibold">
                    <T>managedByDeputy</T>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <T>deputyControlsEmployeeAreaDateTimeMessage</T>
                  </p>
                </div>
              )}
              <Field label="title" id="event-title">
                <Input
                  id="event-title"
                  value={draft.title}
                  onChange={(event) =>
                    change({ ...draft, title: event.target.value })
                  }
                  className="border border-input px-3 text-base"
                  disabled={deputyManaged}
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
                  disabled={deputyManaged}
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
                  disabled={deputyManaged}
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
                  {draft.allDay ? (
                    <EventDatePicker
                      id="event-start"
                      value={draft.start.slice(0, 10)}
                      languageTag={languageTag}
                      ariaLabel={t("startDate")}
                      onChange={(value) =>
                        change(updateAllDayStart(draft, value))
                      }
                      disabled={deputyManaged}
                    />
                  ) : (
                    <EventDateTimePicker
                      id="event-start"
                      value={draft.start}
                      languageTag={languageTag}
                      dateAriaLabel={t("starts")}
                      timeAriaLabel={`${t("starts")} ${t("time")}`}
                      disabled={deputyManaged}
                      onDateChange={(value) =>
                        changeTimedStart(replaceLocalDate(draft.start, value))
                      }
                      onTimeChange={(value) =>
                        changeTimedStart(replaceLocalTime(draft.start, value))
                      }
                      onTimeBlur={(value) =>
                        changeTimedStart(replaceLocalTime(draft.start, value))
                      }
                    />
                  )}
                </Field>
                <Field label={draft.allDay ? "lastDay" : "ends"} id="event-end">
                  {draft.allDay ? (
                    <EventDatePicker
                      id="event-end"
                      value={addCalendarDays(draft.end.slice(0, 10), -1)}
                      minimum={draft.start.slice(0, 10)}
                      languageTag={languageTag}
                      ariaLabel={t("lastDay")}
                      onChange={(value) => {
                        setEndDateWasEdited(true)
                        change({
                          ...draft,
                          end: `${addCalendarDays(value, 1)}T00:00`,
                        })
                      }}
                      disabled={deputyManaged}
                    />
                  ) : (
                    <EventDateTimePicker
                      id="event-end"
                      value={draft.end}
                      languageTag={languageTag}
                      dateAriaLabel={t("ends")}
                      timeAriaLabel={`${t("ends")} ${t("time")}`}
                      disabled={deputyManaged}
                      onDateChange={(value) => {
                        setEndDateWasEdited(true)
                        change(
                          clearEventInstants({
                            ...draft,
                            end: replaceLocalDate(draft.end, value),
                          })
                        )
                      }}
                      onTimeChange={(value) =>
                        changeTimedEnd(replaceLocalTime(draft.end, value))
                      }
                    />
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
                        disabled={deputyManaged}
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
                      className="flex min-w-0 flex-wrap items-center gap-2 text-muted-foreground"
                    >
                      <Paperclip className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 wrap-break-word text-foreground">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-xs">
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
                  disabled={deputyManaged}
                  onChange={(event) =>
                    change({ ...draft, published: event.target.checked })
                  }
                />
                <T>publishNow</T>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isPrivate}
                  disabled={!canManagePrivacy}
                  onChange={(event) =>
                    change({ ...draft, isPrivate: event.target.checked })
                  }
                />
                <T>private</T>
              </label>
              {!canManagePrivacy && (
                <p className="text-xs text-muted-foreground">
                  <T>eventPrivacyManagerAccessRequired</T>
                </p>
              )}
              {deputyManaged && !draft.isPrivate && (
                <div
                  role="alert"
                  className="border border-warning/40 bg-warning/10 p-3 text-sm"
                >
                  <p className="flex items-center gap-2 font-semibold">
                    <TriangleAlert className="size-4" />
                    <T>publicDeputyShiftWarningTitle</T>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <T>publicDeputyShiftWarningMessage</T>
                  </p>
                </div>
              )}
              <Field label="eventType" id="event-type">
                <Select
                  value={draft.category}
                  disabled={deputyManaged}
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
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={leave}
          >
            <T>cancel</T>
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => void submit()}
            disabled={saving}
          >
            <T>{saving ? "saving" : "saveEvent"}</T>
          </Button>
        </div>
      </div>
    </div>
  )
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
