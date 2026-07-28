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
import { GripHorizontal, Pin, Plus, StickyNote, X } from "lucide-react"
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
  const windowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const isMemberView =
    isDesktop && isAuthenticated && !searchParams.get("hub") && Boolean(hub)

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
      if (!desktop.matches) setIsOpen(false)
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
      setIsWriting(false)
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
        className="fixed right-0 bottom-12 z-40 h-auto flex-col gap-2 border-r-0 bg-background px-3 py-4 shadow-md"
        aria-expanded={isOpen}
        aria-controls="worker-notes-window"
        onClick={() => setIsOpen((open) => !open)}
      >
        <StickyNote className="size-5" />
        <span className="max-w-16 text-center leading-4">
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
            className="flex touch-none items-start gap-4 border-b bg-muted/40 px-6 py-4 select-none"
            onPointerDown={startDragging}
            onPointerMove={moveWindow}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <GripHorizontal
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <h2
                  id="worker-notes-title"
                  className="font-heading text-xl font-semibold"
                >
                  {t("workersNotes")}
                </h2>
              </div>
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

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {notes === undefined ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t("loadingWorkersNotes")}
              </p>
            ) : (
              <ul className="space-y-1">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      className={cn(
                        "group/note flex w-full items-start gap-3 border border-transparent px-2 py-2 text-left text-sm leading-6 transition-colors outline-none hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
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
                {!notes.length && !isWriting && (
                  <li className="px-2 py-2 text-sm text-muted-foreground">
                    {t("workersNotesEmpty")}
                  </li>
                )}
                {isWriting && (
                  <li className="flex items-start gap-3 px-2 py-2">
                    <span
                      className="mt-4 size-1.5 shrink-0 rounded-full bg-foreground"
                      aria-hidden="true"
                    />
                    <form className="min-w-0 flex-1" onSubmit={submitNote}>
                      <Input
                        ref={inputRef}
                        value={noteText}
                        maxLength={500}
                        placeholder={t("workerNotePlaceholder")}
                        aria-label={t("workerNotePlaceholder")}
                        disabled={isSubmitting}
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("workerNoteSubmitHint")}
                      </p>
                    </form>
                  </li>
                )}
              </ul>
            )}
          </div>

          {!isWriting && (
            <div className="border-t px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => setIsWriting(true)}
              >
                <Plus />
                {t("clickToWriteMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
