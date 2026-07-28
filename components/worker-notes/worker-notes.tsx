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
import type { FunctionReturnType } from "convex/server"
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
const NOTE_ROW_CLASS =
  "flex w-full items-start gap-3 border border-transparent px-2 py-1 text-left text-sm leading-6"
const ENTRY_BULLET_CLASS = "mt-2 size-1.5 shrink-0 rounded-full"

type WorkerNote = FunctionReturnType<
  typeof api.workerNotes.list
>["notes"][number]

function NotePinButton({
  label,
  note,
  pending,
  onToggle,
}: {
  label: string
  note: WorkerNote
  pending: boolean
  onToggle: (note: WorkerNote) => Promise<void>
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "-my-1 -mr-1 size-6 shrink-0 opacity-0 transition-opacity group-focus-within/note:opacity-100 group-hover/note:opacity-100",
        note.pinned && "opacity-100"
      )}
      aria-label={label}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation()
        void onToggle(note)
      }}
    >
      <Pin
        className={cn(
          "size-4",
          note.pinned ? "fill-primary text-primary" : "text-muted-foreground"
        )}
        aria-hidden="true"
      />
    </Button>
  )
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
  const [editingNoteId, setEditingNoteId] = useState<Id<"workerNotes"> | null>(
    null
  )
  const [editingText, setEditingText] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [pendingNoteId, setPendingNoteId] = useState<Id<"workerNotes"> | null>(
    null
  )
  const [position, setPosition] = useState<WindowPosition | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [restoredHubId, setRestoredHubId] = useState<string | null>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const createSaveRef = useRef(false)
  const closeAfterCreateRef = useRef(false)
  const editInputRef = useRef<HTMLInputElement>(null)
  const editSaveRef = useRef(false)
  const editDestinationRef = useRef<WorkerNote | "new" | null>(null)
  const cancelEditRef = useRef(false)
  const noteAreaWasActiveRef = useRef(false)
  const dragRef = useRef<DragState | null>(null)
  const activeHubId = hub?.id
  const isMemberView =
    isDesktop &&
    isAuthenticated &&
    !searchParams.get("hub") &&
    Boolean(activeHubId) &&
    restoredHubId === activeHubId

  const notesResult = useQuery(
    api.workerNotes.list,
    isMemberView && isOpen && hub ? { hubId: hub.id, now } : "skip"
  )
  const notes = notesResult?.notes
  const isAtLimit =
    notesResult !== undefined && notesResult.count >= notesResult.limit
  const createNote = useMutation(api.workerNotes.create)
  const togglePinned = useMutation(api.workerNotes.togglePinned)
  const updateNoteText = useMutation(api.workerNotes.updateText)

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
    if (!isMemberView || !isOpen) return
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [isMemberView, isOpen])

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
    if (!editingNoteId) return
    const input = editInputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [editingNoteId])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isWriting && !editingNoteId) {
        setIsOpen(false)
      }
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
  }, [editingNoteId, isOpen, isWriting])

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

  async function saveNewNote(closeAfterSave: boolean) {
    if (closeAfterSave) closeAfterCreateRef.current = true
    if (createSaveRef.current) return

    const text = noteText.trim()
    if (!text) {
      if (closeAfterSave) {
        setNoteText("")
        setIsWriting(false)
        closeAfterCreateRef.current = false
      }
      return
    }

    createSaveRef.current = true
    setIsSubmitting(true)
    try {
      await createNote({ hubId, text })
      setNoteText("")
      setIsWriting(!closeAfterCreateRef.current)
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      createSaveRef.current = false
      closeAfterCreateRef.current = false
      setIsSubmitting(false)
    }
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void saveNewNote(false)
  }

  function beginEditing(note: WorkerNote) {
    cancelEditRef.current = false
    editDestinationRef.current = null
    setIsWriting(false)
    setEditingNoteId(note.id)
    setEditingText(note.text)
  }

  async function finishEditing(openNewLine: boolean) {
    if (!editingNoteId || editSaveRef.current) return
    if (openNewLine) editDestinationRef.current = "new"
    const noteId = editingNoteId
    const text = editingText
    editSaveRef.current = true
    setIsSavingEdit(true)
    try {
      await updateNoteText({ hubId, noteId, text })
      const destination = editDestinationRef.current
      editDestinationRef.current = null
      if (destination && destination !== "new") {
        beginEditing(destination)
      } else {
        setEditingNoteId(null)
        setEditingText("")
        setIsWriting(destination === "new")
      }
    } catch (error) {
      editDestinationRef.current = null
      toast.error(translateError(error))
    } finally {
      editSaveRef.current = false
      setIsSavingEdit(false)
    }
  }

  async function deleteEditingNoteAndMoveUp(note: WorkerNote) {
    if (editSaveRef.current) return
    const noteIndex = notes?.findIndex((item) => item.id === note.id) ?? -1
    const previousNote =
      noteIndex > 0 && notes ? notes[noteIndex - 1] : undefined
    editSaveRef.current = true
    setIsSavingEdit(true)
    try {
      await updateNoteText({ hubId, noteId: note.id, text: "" })
      if (previousNote) {
        setEditingNoteId(previousNote.id)
        setEditingText(previousNote.text)
        setIsWriting(false)
      } else {
        setEditingNoteId(null)
        setEditingText("")
        setIsWriting(true)
      }
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      editSaveRef.current = false
      setIsSavingEdit(false)
    }
  }

  function handleNewNoteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setNoteText("")
      setIsWriting(false)
      return
    }
    if ((event.key !== "Backspace" && event.key !== "ArrowUp") || noteText) {
      return
    }
    const previousNote = notes ? notes[notes.length - 1] : undefined
    if (!previousNote) return
    event.preventDefault()
    beginEditing(previousNote)
  }

  function handleEditingKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    note: WorkerNote
  ) {
    if (event.key === "Escape") {
      cancelEditRef.current = true
      editDestinationRef.current = null
      setEditingNoteId(null)
      setEditingText("")
      setIsWriting(true)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      void finishEditing(true)
      return
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const noteIndex = notes?.findIndex((item) => item.id === note.id) ?? -1
      const destination =
        event.key === "ArrowUp"
          ? noteIndex > 0 && notes
            ? notes[noteIndex - 1]
            : null
          : notes && noteIndex >= 0 && noteIndex < notes.length - 1
            ? notes[noteIndex + 1]
            : "new"
      if (!destination) return
      event.preventDefault()
      editDestinationRef.current = destination
      void finishEditing(false)
      return
    }
    if (event.key !== "Backspace" || editingText) return
    event.preventDefault()
    void deleteEditingNoteAndMoveUp(note)
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

  function activateNote(note: WorkerNote) {
    if (editInputRef.current) {
      editDestinationRef.current = note
      void finishEditing(false)
      return
    }
    beginEditing(note)
  }

  return (
    <>
      <Button
        type="button"
        variant={isOpen ? "selected" : "outline"}
        className="fixed right-4 bottom-4 z-40 h-auto items-center justify-center gap-2 bg-background px-3! py-2 whitespace-normal shadow-md"
        aria-expanded={isOpen}
        aria-controls="worker-notes-window"
        onClick={() => {
          setNow(Date.now())
          setIsOpen((open) => !open)
        }}
      >
        <StickyNote className="size-5" />
        <span className="w-full text-center leading-4 wrap-break-word whitespace-normal">
          {t("workersNotes")}
        </span>
      </Button>

      {isOpen && (
        <div
          ref={windowRef}
          id="worker-notes-window"
          role="dialog"
          aria-labelledby="worker-notes-title"
          className="fixed z-50 flex h-[min(34rem,calc(100vh-2rem))] w-md flex-col overflow-hidden border bg-card text-card-foreground shadow-xl"
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
              <p
                className={cn(
                  "mt-2 text-sm leading-5 text-muted-foreground",
                  isAtLimit && "text-destructive"
                )}
              >
                {t(
                  isAtLimit
                    ? "workersNotesLimitWarning"
                    : "workersNotesDescription",
                  {
                    count: notesResult?.count ?? "…",
                    limit: notesResult?.limit ?? 100,
                  }
                )}
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
            onPointerDownCapture={() => {
              noteAreaWasActiveRef.current = isWriting || editingNoteId !== null
            }}
            onClick={() => {
              const wasActive = noteAreaWasActiveRef.current
              noteAreaWasActiveRef.current = false
              if (!wasActive && !editingNoteId && !isWriting && !isAtLimit) {
                setIsWriting(true)
              }
            }}
          >
            {notes === undefined ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t("loadingWorkersNotes")}
              </p>
            ) : (
              <ul>
                {notes.map((note) =>
                  editingNoteId === note.id ? (
                    <li
                      key={note.id}
                      className={cn(NOTE_ROW_CLASS, "group/note")}
                    >
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground"
                        aria-hidden="true"
                      />
                      <form
                        className="min-w-0 flex-1"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void finishEditing(true)
                        }}
                      >
                        <Input
                          ref={editInputRef}
                          value={editingText}
                          maxLength={500}
                          aria-label={note.text}
                          readOnly={isSavingEdit}
                          aria-busy={isSavingEdit}
                          className="h-6 border-0 py-0 text-sm leading-6 focus-visible:border-0"
                          onChange={(event) =>
                            setEditingText(event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleEditingKeyDown(event, note)
                          }
                          onBlur={() => {
                            if (!cancelEditRef.current) {
                              void finishEditing(false)
                            }
                          }}
                        />
                      </form>
                      <NotePinButton
                        label={t(
                          note.pinned ? "unpinWorkerNote" : "pinWorkerNote",
                          { note: note.text }
                        )}
                        note={note}
                        pending={pendingNoteId === note.id}
                        onToggle={handleTogglePinned}
                      />
                    </li>
                  ) : (
                    <li
                      key={note.id}
                      className={cn(
                        NOTE_ROW_CLASS,
                        "group/note transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30 hover:bg-muted/60",
                        note.pinned && "font-medium"
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none"
                        aria-label={note.text}
                        onClick={(event) => {
                          event.stopPropagation()
                          activateNote(note)
                        }}
                      >
                        <span
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 wrap-break-word whitespace-pre-wrap">
                          {note.text}
                        </span>
                      </button>
                      <NotePinButton
                        label={t(
                          note.pinned ? "unpinWorkerNote" : "pinWorkerNote",
                          { note: note.text }
                        )}
                        note={note}
                        pending={pendingNoteId === note.id}
                        onToggle={handleTogglePinned}
                      />
                    </li>
                  )
                )}
                {editingNoteId ? null : isWriting ? (
                  <li className={NOTE_ROW_CLASS}>
                    <span
                      className={cn(ENTRY_BULLET_CLASS, "bg-foreground")}
                      aria-hidden="true"
                    />
                    <form className="min-w-0 flex-1" onSubmit={submitNote}>
                      <Input
                        ref={inputRef}
                        value={noteText}
                        maxLength={500}
                        aria-label={t("workerNotePlaceholder")}
                        readOnly={isSubmitting}
                        aria-busy={isSubmitting}
                        className="h-6 border-0 py-0 text-sm leading-6 focus-visible:border-0"
                        onChange={(event) => setNoteText(event.target.value)}
                        onKeyDown={handleNewNoteKeyDown}
                        onBlur={() => void saveNewNote(true)}
                      />
                    </form>
                  </li>
                ) : isAtLimit ? null : (
                  <li>
                    <button
                      type="button"
                      className={cn(
                        NOTE_ROW_CLASS,
                        "text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                      )}
                      onClick={() => setIsWriting(true)}
                    >
                      <span
                        className={cn(
                          ENTRY_BULLET_CLASS,
                          "bg-muted-foreground"
                        )}
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
