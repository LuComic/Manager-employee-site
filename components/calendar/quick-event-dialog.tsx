"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { EventDateTimePicker } from "@/components/calendar/event-date-time-picker"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "@/i18n/navigation"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"
import { addHoursToLocalDateTime, slugify } from "@/lib/operations"
import {
  createQuickEventDraft,
  quickEventDraftToCalendarEvent,
  storeQuickEventDraft,
  type QuickEventDraft,
} from "@/lib/quick-event-draft"

export function QuickEventDialog({ defaultDate }: { defaultDate: string }) {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const router = useRouter()
  const { events, eventTypes, hub, managerAccess, saveEvent, showFeedback } =
    useOperations()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<QuickEventDraft>(() =>
    createQuickEventDraft(defaultDate)
  )
  const [endDateWasEdited, setEndDateWasEdited] = useState(false)
  const [endTimeWasEdited, setEndTimeWasEdited] = useState(false)
  const [error, setError] = useState<AppMessageKey | "">("")
  const [saving, setSaving] = useState(false)

  if (!managerAccess || !hub?.workersCanEdit.events) return null

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    setError("")
    if (nextOpen) {
      setDraft(createQuickEventDraft(defaultDate))
      setEndDateWasEdited(false)
      setEndTimeWasEdited(false)
    }
  }

  function changeStart(start: string) {
    const suggestedEnd = addHoursToLocalDateTime(start, 1)
    let end = suggestedEnd || draft.end
    if (suggestedEnd && endDateWasEdited) {
      end = replaceLocalDate(end, draft.end.slice(0, 10))
    }
    if (suggestedEnd && endTimeWasEdited) {
      end = replaceLocalTime(end, localTime(draft.end))
    }
    setDraft({
      ...draft,
      start,
      end,
    })
    setError("")
  }

  function validate() {
    if (!draft.title.trim() || !draft.description.trim()) {
      setError("addANameAndDescription")
      return false
    }
    if (
      !addHoursToLocalDateTime(draft.start, 0) ||
      !addHoursToLocalDateTime(draft.end, 0)
    ) {
      setError("addStartEndDateTime")
      return false
    }
    if (draft.end <= draft.start) {
      setError("endLaterThanStart")
      return false
    }
    if (!eventTypes[0]) {
      setError("eventCategoryNotFound")
      return false
    }
    return true
  }

  function continueWithMoreDetails() {
    if (!hub) return
    storeQuickEventDraft(hub.id, draft)
    router.push("/manager/calendar/new")
  }

  async function submit() {
    if (!validate() || !hub || !eventTypes[0]) return
    const base = slugify(draft.title) || "event"
    let id = base
    let suffix = 2
    while (events.some((event) => event.id === id)) {
      id = `${base}-${suffix}`
      suffix += 1
    }

    setSaving(true)
    try {
      await saveEvent(
        quickEventDraftToCalendarEvent(
          {
            ...draft,
            title: draft.title.trim(),
            description: draft.description.trim(),
          },
          {
            id,
            category: eventTypes[0].id,
            location: hub.address.trim() || hub.name.trim() || t("workplace"),
          }
        )
      )
      showFeedback("eventCreated")
      setOpen(false)
      setDraft(createQuickEventDraft(defaultDate))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        size="icon-sm"
        className="size-9 min-h-0"
        aria-label={t("createEvent")}
        onClick={() => setOpen(true)}
      >
        <Plus />
      </Button>
      <DialogContent className="sm:max-w-2xl">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              <T>quickAddEvent</T>
            </DialogTitle>
            <DialogDescription>
              <T>quickAddEventDescription</T>
            </DialogDescription>
          </DialogHeader>
          <div className="my-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-event-title">
                <T>eventName</T>
              </Label>
              <Input
                id="quick-event-title"
                autoFocus
                required
                maxLength={140}
                value={draft.title}
                onChange={(event) => {
                  setDraft({ ...draft, title: event.target.value })
                  setError("")
                }}
                className="border border-input px-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-event-description">
                <T>description</T>
              </Label>
              <Textarea
                id="quick-event-description"
                required
                maxLength={500}
                value={draft.description}
                onChange={(event) => {
                  setDraft({ ...draft, description: event.target.value })
                  setError("")
                }}
                className="min-h-24 border border-input px-3"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-event-start">
                  <T>starts</T>
                </Label>
                <EventDateTimePicker
                  id="quick-event-start"
                  value={draft.start}
                  languageTag={languageTag}
                  dateAriaLabel={t("starts")}
                  timeAriaLabel={`${t("starts")} ${t("time")}`}
                  onDateChange={(value) =>
                    changeStart(replaceLocalDate(draft.start, value))
                  }
                  onTimeChange={(value) =>
                    changeStart(replaceLocalTime(draft.start, value))
                  }
                  onTimeBlur={(value) =>
                    changeStart(replaceLocalTime(draft.start, value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-event-end">
                  <T>ends</T>
                </Label>
                <EventDateTimePicker
                  id="quick-event-end"
                  value={draft.end}
                  languageTag={languageTag}
                  dateAriaLabel={t("ends")}
                  timeAriaLabel={`${t("ends")} ${t("time")}`}
                  onDateChange={(value) => {
                    setEndDateWasEdited(true)
                    setDraft({
                      ...draft,
                      end: replaceLocalDate(draft.end, value),
                    })
                    setError("")
                  }}
                  onTimeChange={(value) => {
                    setEndTimeWasEdited(true)
                    setDraft({
                      ...draft,
                      end: replaceLocalTime(draft.end, value),
                    })
                    setError("")
                  }}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                <T>{error}</T>
              </p>
            )}
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="whitespace-nowrap"
              onClick={continueWithMoreDetails}
            >
              <T>continueWithMoreDetails</T>
            </Button>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="whitespace-nowrap"
                onClick={() => setOpen(false)}
              >
                <T>cancel</T>
              </Button>
              <Button
                type="submit"
                className="whitespace-nowrap"
                disabled={saving}
              >
                <T>{saving ? "saving" : "saveEvent"}</T>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
