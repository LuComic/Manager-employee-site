import { addCalendarDays, type CalendarEvent } from "@/lib/operations"

const STORAGE_PREFIX = "workhal:quick-event-draft"

export type QuickEventDraft = {
  title: string
  description: string
  startDate: string
  endDate: string
}

export function createQuickEventDraft(startDate: string): QuickEventDraft {
  return {
    title: "",
    description: "",
    startDate,
    endDate: startDate,
  }
}

export function quickEventDraftToCalendarEvent(
  draft: QuickEventDraft,
  defaults: Pick<CalendarEvent, "id" | "category" | "location">
): CalendarEvent {
  return {
    ...defaults,
    title: draft.title,
    description: draft.description,
    start: `${draft.startDate}T00:00`,
    end: `${addCalendarDays(draft.endDate, 1)}T00:00`,
    allDay: true,
    employees: [],
    notes: "",
    attachments: [],
    guideIds: [],
    published: true,
    isPrivate: false,
  }
}

export function storeQuickEventDraft(hubId: string, draft: QuickEventDraft) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(storageKey(hubId), JSON.stringify(draft))
}

export function takeQuickEventDraft(hubId: string): QuickEventDraft | null {
  if (typeof window === "undefined") return null
  const key = storageKey(hubId)
  const value = window.sessionStorage.getItem(key)
  if (!value) return null
  window.sessionStorage.removeItem(key)

  try {
    const draft: unknown = JSON.parse(value)
    return isQuickEventDraft(draft) ? draft : null
  } catch {
    return null
  }
}

function storageKey(hubId: string) {
  return `${STORAGE_PREFIX}:${hubId}`
}

function isQuickEventDraft(value: unknown): value is QuickEventDraft {
  if (!value || typeof value !== "object") return false
  const draft = value as Record<string, unknown>
  return (
    typeof draft.title === "string" &&
    typeof draft.description === "string" &&
    isDateKey(draft.startDate) &&
    isDateKey(draft.endDate) &&
    draft.endDate >= draft.startDate
  )
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  )
  return date.toISOString().slice(0, 10) === value
}
