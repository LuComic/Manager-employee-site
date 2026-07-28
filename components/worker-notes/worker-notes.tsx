"use client"

import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { useSearchParams } from "next/navigation"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { Pin, StickyNote, X } from "lucide-react"
import { toast } from "sonner"

import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  useAppErrorTranslation,
  useAppTranslations,
} from "@/i18n/use-app-translations"
import { cn } from "@/lib/utils"

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)"
const WINDOW_EDGE_GAP = 16
const WINDOW_WIDTH = 448
const WINDOW_MAX_HEIGHT = 544

type WorkerNote = {
  id: Id<"workerNotes">
  text: string
  pinned: boolean
  createdAt: number
  expiresAt: number
}

type WindowPosition = {
  x: number
  y: number
}

type DragState = {
  pointerId: number
  offsetX: number
  offsetY: number
}

type StoredWindowPreferences = {
  isOpen: boolean
  position: WindowPosition | null
}

function preferencesKey(hubId: string) {
  return `workhal:worker-notes:${hubId}`
}

function readWindowPreferences(hubId: string): StoredWindowPreferences {
  const fallback = { isOpen: false, position: null }
  try {
    const stored = JSON.parse(
      localStorage.getItem(preferencesKey(hubId)) ?? "null"
    ) as {
      isOpen?: unknown
      position?: { x?: unknown; y?: unknown } | null
    } | null
    const position =
      stored?.position &&
      typeof stored.position.x === "number" &&
      Number.isFinite(stored.position.x) &&
      typeof stored.position.y === "number" &&
      Number.isFinite(stored.position.y)
        ? clampWindowPosition(
            stored.position.x,
            stored.position.y,
            WINDOW_WIDTH,
            Math.min(
              WINDOW_MAX_HEIGHT,
              window.innerHeight - WINDOW_EDGE_GAP * 2
            )
          )
        : null
    return {
      isOpen: stored?.isOpen === true,
      position,
    }
  } catch {
    return fallback
  }
}

function clampWindowPosition(
  x: number,
  y: number,
  width: number,
  height: number
): WindowPosition {
  return {
    x: Math.min(
      Math.max(WINDOW_EDGE_GAP, x),
      Math.max(WINDOW_EDGE_GAP, window.innerWidth - width - WINDOW_EDGE_GAP)
    ),
    y: Math.min(
      Math.max(WINDOW_EDGE_GAP, y),
      Math.max(WINDOW_EDGE_GAP, window.innerHeight - height - WINDOW_EDGE_GAP)
    ),
  }
}

export function WorkerNotes() {
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
  const searchParams = useSearchParams()
  const { hub } = useOperations()
  const { isAuthenticated } = useConvexAuth()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isWriting, setIsWriting] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingNoteId, setPendingNoteId] = useState<Id<"workerNotes"> | null>(
    null
  )
  const [position, setPosition] = useState<WindowPosition | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [restoredHubId, setRestoredHubId] = useState<string | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const activeHubId = hub?.id
  const isMemberView =
    isDesktop &&
    isAuthenticated &&
    !searchParams.get("hub") &&
    Boolean(activeHubId) &&
    restoredHubId === activeHubId

  const notes = useQuery(
    api.workerNotes.list,
    isMemberView && hub ? { hubId: hub.id, now } : "skip"
  ) as WorkerNote[] | undefined
  const createNote = useMutation(api.workerNotes.create)
  const togglePinned = useMutation(api.workerNotes.togglePinned)

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const updateDesktop = () => {
      setIsDesktop(desktop.matches)
    }
    updateDesktop()
    desktop.addEventListener("change", updateDesktop)
    return () => desktop.removeEventListener("change", updateDesktop)
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!activeHubId) return
    const preferences = readWindowPreferences(activeHubId)
    const timeout = window.setTimeout(() => {
      setIsOpen(preferences.isOpen)
      setPosition(preferences.position)
      setRestoredHubId(activeHubId)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [activeHubId])

  useEffect(() => {
    if (!activeHubId || restoredHubId !== activeHubId) return
    localStorage.setItem(
      preferencesKey(activeHubId),
      JSON.stringify({ isOpen, position } satisfies StoredWindowPreferences)
    )
  }, [activeHubId, isOpen, position, restoredHubId])

  useEffect(() => {
    if (!isWriting) return
    inputRef.current?.focus()
  }, [isWriting])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isWriting) setIsOpen(false)
    }
    const handleResize = () => {
      const panel = windowRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      setPosition(
        clampWindowPosition(rect.left, rect.top, rect.width, rect.height)
      )
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", handleResize)
    }
  }, [isOpen, isWriting])

  if (!isMemberView || !hub) return null
  const hubId = hub.id

  function startDragging(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !windowRef.current) return
    const rect = windowRef.current.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    setPosition({ x: rect.left, y: rect.top })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveWindow(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const panel = windowRef.current
    if (!drag || drag.pointerId !== event.pointerId || !panel) return
    setPosition(
      clampWindowPosition(
        event.clientX - drag.offsetX,
        event.clientY - drag.offsetY,
        panel.offsetWidth,
        panel.offsetHeight
      )
    )
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = noteText.trim()
    if (!text || isSubmitting) return
    setIsSubmitting(true)
    try {
      await createNote({ hubId, text })
      setNoteText("")
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTogglePinned(note: WorkerNote) {
    if (pendingNoteId) return
    setPendingNoteId(note.id)
    try {
      await togglePinned({ hubId, noteId: note.id })
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      setPendingNoteId(null)
    }
  }

  function handleNoteKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    note: WorkerNote
  ) {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    void handleTogglePinned(note)
  }

  return (
    <>
      <Button
        type="button"
        variant={isOpen ? "selected" : "outline"}
        className="fixed right-4 bottom-4 z-40 h-auto w-28 flex-col gap-2 bg-background px-3 py-4 whitespace-normal shadow-md"
        aria-expanded={isOpen}
        aria-controls="worker-notes-window"
        onClick={() => setIsOpen((open) => !open)}
      >
        <StickyNote className="size-5" />
        <span className="w-full text-center leading-4 break-words whitespace-normal">
          {t("workersNotes")}
        </span>
      </Button>

      {isOpen && (
        <div
          ref={windowRef}
          id="worker-notes-window"
          role="dialog"
          aria-labelledby="worker-notes-title"
          className="fixed z-50 flex h-[min(34rem,calc(100vh-2rem))] w-[28rem] flex-col overflow-hidden border bg-card text-card-foreground shadow-xl ring-1 ring-foreground/10"
          style={
            position
              ? { left: position.x, top: position.y }
              : { right: "5rem", bottom: "2rem" }
          }
        >
          <div
            className="flex cursor-move touch-none items-start gap-4 border-b bg-muted/40 px-6 py-4 select-none"
            onPointerDown={startDragging}
            onPointerMove={moveWindow}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <div className="min-w-0 flex-1">
              <h2
                id="worker-notes-title"
                className="font-heading text-xl font-semibold"
              >
                {t("workersNotes")}
              </h2>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                {t("workersNotesDescription")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-mt-1 -mr-2"
              aria-label={t("close")}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setIsOpen(false)}
            >
              <X className="size-5" />
            </Button>
          </div>

          <div
            className="min-h-0 flex-1 cursor-text overflow-y-auto px-6 py-6"
            onClick={() => setIsWriting(true)}
          >
            {notes === undefined ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t("loadingWorkersNotes")}
              </p>
            ) : (
              <ul>
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      className={cn(
                        "group/note flex w-full items-start gap-3 border border-transparent px-2 py-1 text-left text-sm leading-6 transition-colors outline-none hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
                        note.pinned && "font-medium"
                      )}
                      aria-label={t(
                        note.pinned ? "unpinWorkerNote" : "pinWorkerNote",
                        { note: note.text }
                      )}
                      title={t("doubleClickToPinWorkerNote")}
                      disabled={pendingNoteId === note.id}
                      onDoubleClick={() => void handleTogglePinned(note)}
                      onKeyDown={(event) => handleNoteKeyDown(event, note)}
                    >
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                        {note.text}
                      </span>
                      <Pin
                        className={cn(
                          "mt-1 size-4 shrink-0 transition-opacity",
                          note.pinned
                            ? "fill-primary text-primary opacity-100"
                            : "text-muted-foreground opacity-0 group-hover/note:opacity-50 group-focus-visible/note:opacity-50"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
                {isWriting ? (
                  <li className="flex items-start gap-3 px-2 py-2">
                    <span
                      className="mt-3 size-1.5 shrink-0 rounded-full bg-foreground"
                      aria-hidden="true"
                    />
                    <form className="min-w-0 flex-1" onSubmit={submitNote}>
                      <Input
                        ref={inputRef}
                        value={noteText}
                        maxLength={500}
                        placeholder={t("workerNotePlaceholder")}
                        aria-label={t("workerNotePlaceholder")}
                        readOnly={isSubmitting}
                        aria-busy={isSubmitting}
                        className="h-6 border-transparent py-0 text-sm focus-visible:border-transparent"
                        onChange={(event) => setNoteText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Escape") return
                          setNoteText("")
                          setIsWriting(false)
                        }}
                        onBlur={() => {
                          if (!noteText.trim()) setIsWriting(false)
                        }}
                      />
                    </form>
                  </li>
                ) : (
                  <li>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 border border-transparent px-2 py-2 text-left text-sm leading-6 text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                      onClick={() => setIsWriting(true)}
                    >
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{t("clickToWriteMore")}</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
