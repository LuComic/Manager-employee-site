"use client"

import { createContext, useContext, useMemo, useState } from "react"

import type { Category, Guide } from "@/lib/knowledge-base"
import {
  createSeedState,
  type Announcement,
  type CalendarEvent,
  type OperationsState,
} from "@/lib/operations"

type OperationsContextValue = OperationsState & {
  saveCategory: (category: Category) => void
  moveCategory: (id: string, direction: -1 | 1) => void
  deleteCategory: (id: string) => void
  saveGuide: (guide: Guide) => void
  deleteGuide: (id: string) => void
  saveEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => void
  saveAnnouncement: (announcement: Announcement) => void
  deleteAnnouncement: (id: string) => void
  feedback: string
  showFeedback: (message: string) => void
}

const OperationsContext = createContext<OperationsContextValue | null>(null)

export function OperationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<OperationsState>(createSeedState)
  const [feedback, setFeedback] = useState("")

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(
      () => setFeedback((current) => (current === message ? "" : current)),
      3000
    )
  }

  const value = useMemo<OperationsContextValue>(
    () => ({
      ...state,
      saveCategory: (category) =>
        setState((current) => ({
          ...current,
          categories: current.categories.some((item) => item.id === category.id)
            ? current.categories.map((item) =>
                item.id === category.id ? category : item
              )
            : [...current.categories, category],
        })),
      moveCategory: (id, direction) =>
        setState((current) => {
          const from = current.categories.findIndex((item) => item.id === id)
          const to = from + direction
          if (from < 0 || to < 0 || to >= current.categories.length)
            return current
          const categories = [...current.categories]
          const [category] = categories.splice(from, 1)
          categories.splice(to, 0, category)
          return { ...current, categories }
        }),
      deleteCategory: (id) =>
        setState((current) =>
          current.guides.some((guide) => guide.category === id)
            ? current
            : {
                ...current,
                categories: current.categories.filter(
                  (category) => category.id !== id
                ),
              }
        ),
      saveGuide: (guide) =>
        setState((current) => ({
          ...current,
          guides: current.guides.some((item) => item.id === guide.id)
            ? current.guides.map((item) =>
                item.id === guide.id ? guide : item
              )
            : [guide, ...current.guides],
        })),
      deleteGuide: (id) =>
        setState((current) => ({
          ...current,
          guides: current.guides.filter((item) => item.id !== id),
          events: current.events.map((event) => ({
            ...event,
            guideIds: event.guideIds.filter((guideId) => guideId !== id),
          })),
          announcements: current.announcements.map((announcement) =>
            announcement.guideId === id
              ? { ...announcement, guideId: undefined }
              : announcement
          ),
        })),
      saveEvent: (event) =>
        setState((current) => ({
          ...current,
          events: current.events.some((item) => item.id === event.id)
            ? current.events.map((item) =>
                item.id === event.id ? event : item
              )
            : [event, ...current.events],
        })),
      deleteEvent: (id) =>
        setState((current) => ({
          ...current,
          events: current.events.filter((item) => item.id !== id),
          announcements: current.announcements.map((announcement) =>
            announcement.eventId === id
              ? { ...announcement, eventId: undefined }
              : announcement
          ),
        })),
      saveAnnouncement: (announcement) =>
        setState((current) => ({
          ...current,
          announcements: current.announcements.some(
            (item) => item.id === announcement.id
          )
            ? current.announcements.map((item) =>
                item.id === announcement.id ? announcement : item
              )
            : [announcement, ...current.announcements],
        })),
      deleteAnnouncement: (id) =>
        setState((current) => ({
          ...current,
          announcements: current.announcements.filter((item) => item.id !== id),
        })),
      feedback,
      showFeedback,
    }),
    [state, feedback]
  )

  return (
    <OperationsContext.Provider value={value}>
      {children}
      {feedback && (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-50 border bg-foreground px-4 py-3 text-sm text-background shadow-lg"
        >
          {feedback}
        </div>
      )}
    </OperationsContext.Provider>
  )
}

export function useOperations() {
  const context = useContext(OperationsContext)
  if (!context)
    throw new Error("useOperations must be used within OperationsProvider")
  return context
}
