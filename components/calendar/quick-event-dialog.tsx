"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

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
import { useAppTranslations } from "@/i18n/use-app-translations"
import { slugify } from "@/lib/operations"
import {
  createQuickEventDraft,
  quickEventDraftToCalendarEvent,
  storeQuickEventDraft,
  type QuickEventDraft,
} from "@/lib/quick-event-draft"

export function QuickEventDialog({ defaultDate }: { defaultDate: string }) {
  const t = useAppTranslations()
  const router = useRouter()
  const { events, eventTypes, hub, managerAccess, saveEvent, showFeedback } =
    useOperations()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<QuickEventDraft>(() =>
    createQuickEventDraft(defaultDate)
  )
  const [error, setError] = useState<AppMessageKey | "">("")
  const [saving, setSaving] = useState(false)

  if (!managerAccess || !hub?.workersCanEdit.events) return null

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    setError("")
    if (nextOpen) setDraft(createQuickEventDraft(defaultDate))
  }

  function validate() {
    if (!draft.title.trim() || !draft.description.trim()) {
      setError("addANameAndDescription")
      return false
    }
    if (!draft.startDate || !draft.endDate) {
      setError("addStartAndEndDates")
      return false
    }
    if (draft.endDate < draft.startDate) {
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
      <DialogContent className="sm:max-w-lg">
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
                  <T>startDate</T>
                </Label>
                <Input
                  id="quick-event-start"
                  type="date"
                  required
                  value={draft.startDate}
                  onChange={(event) => {
                    const startDate = event.target.value
                    setDraft({
                      ...draft,
                      startDate,
                      endDate:
                        draft.endDate < startDate ? startDate : draft.endDate,
                    })
                    setError("")
                  }}
                  className="border border-input px-3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-event-end">
                  <T>lastDay</T>
                </Label>
                <Input
                  id="quick-event-end"
                  type="date"
                  required
                  min={draft.startDate}
                  value={draft.endDate}
                  onChange={(event) => {
                    setDraft({ ...draft, endDate: event.target.value })
                    setError("")
                  }}
                  className="border border-input px-3"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <T>quickEventsAreAllDay</T>
            </p>
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
              onClick={continueWithMoreDetails}
            >
              <T>continueWithMoreDetails</T>
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                <T>cancel</T>
              </Button>
              <Button type="submit" disabled={saving}>
                <T>{saving ? "saving" : "saveEvent"}</T>
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
