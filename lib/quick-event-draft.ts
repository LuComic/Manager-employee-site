import type { CalendarEvent } from "@/lib/operations"

const STORAGE_PREFIX = "workhal:quick-event-draft"

export type QuickEventDraft = {
  title: string
  description: string
  start: string
  end: string
}

export function createQuickEventDraft(startDate: string): QuickEventDraft {
  return {
    title: "",
    description: "",
    start: `${startDate}T10:00`,
    end: `${startDate}T11:00`,
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
    start: draft.start,
    end: draft.end,
    allDay: false,
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
    isLocalDateTime(draft.start) &&
    isLocalDateTime(draft.end) &&
    draft.end > draft.start
  )
}

function isLocalDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5])
    )
  )
  return date.toISOString().slice(0, 16) === value
}
