"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { StickyNote, X } from "lucide-react"
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

import {
  ENTRY_BULLET_CLASS,
  NOTE_ROW_CLASS,
  NotePinButton,
  type WorkerNote,
} from "./worker-note-row"
import { useWorkerNotesEditor } from "./use-worker-notes-editor"
import { useWorkerNotesWindow } from "./use-worker-notes-window"

export function WorkerNotes() {
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
  const searchParams = useSearchParams()
  const { hub } = useOperations()
  const { isAuthenticated } = useConvexAuth()
  const activeHubId = hub?.id
  const {
    isDesktop,
    isOpen,
    setIsOpen,
    position,
    restored,
    windowRef,
    startDragging,
    moveWindow,
    stopDragging,
  } = useWorkerNotesWindow(activeHubId)
  const [pendingNoteId, setPendingNoteId] = useState<Id<"workerNotes"> | null>(
    null
  )
  const [now, setNow] = useState(() => Date.now())
  const noteAreaWasActiveRef = useRef(false)
  const isMemberView =
    isDesktop &&
    isAuthenticated &&
    !searchParams.get("hub") &&
    Boolean(activeHubId) &&
    restored

  const notesResult = useQuery(
    api.workerNotes.list,
    isMemberView && isOpen && hub ? { hubId: hub.id, now } : "skip"
  )
  const notes = notesResult?.notes
  const isAtLimit =
    notesResult !== undefined && notesResult.count >= notesResult.limit
  const {
    editor,
    isWriting,
    editingNoteId,
    inputRef,
    editInputRef,
    startCreating,
    changeDraft,
    submitNote,
    saveNewNote,
    finishEditing,
    handleNewNoteKeyDown,
    handleEditingKeyDown,
    handleEditingBlur,
    activateNote,
  } = useWorkerNotesEditor({ hubId: hub?.id, notes })
  const setPinned = useMutation(api.workerNotes.setPinned)

  useEffect(() => {
    if (!isMemberView || !isOpen) return
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [isMemberView, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isWriting && !editingNoteId) {
        setIsOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [editingNoteId, isOpen, isWriting, setIsOpen])

  if (!isMemberView || !hub) return null
  const hubId = hub.id

  async function handleSetPinned(note: WorkerNote) {
    if (pendingNoteId) return
    setPendingNoteId(note.id)
    try {
      await setPinned({
        hubId,
        noteId: note.id,
        pinned: !note.pinned,
      })
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      setPendingNoteId(null)
    }
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
            onClick={(event) => {
              const wasActive = noteAreaWasActiveRef.current
              noteAreaWasActiveRef.current = false
              if (
                event.target instanceof HTMLElement &&
                event.target.closest("button, input")
              ) {
                return
              }
              if (!wasActive && !editingNoteId && !isWriting && !isAtLimit) {
                startCreating()
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
                      className={cn(NOTE_ROW_CLASS, "group/note relative pr-9")}
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
                          value={editor.draft}
                          maxLength={500}
                          aria-label={note.text}
                          readOnly={editor.saving}
                          aria-busy={editor.saving}
                          className="h-6 border-0! py-0 text-sm leading-6 focus-visible:border-0!"
                          onChange={(event) => changeDraft(event.target.value)}
                          onKeyDown={(event) =>
                            handleEditingKeyDown(event, note)
                          }
                          onBlur={handleEditingBlur}
                        />
                        {editor.conflictText && (
                          <p
                            className="mt-2 text-xs leading-5 text-destructive"
                            role="alert"
                          >
                            {t("workerNoteChanged")}{" "}
                            {t("workerNoteLatestText", {
                              note: editor.conflictText,
                            })}
                          </p>
                        )}
                      </form>
                      <NotePinButton
                        label={t(
                          note.pinned ? "unpinWorkerNote" : "pinWorkerNote",
                          { note: note.text }
                        )}
                        note={note}
                        pending={pendingNoteId !== null}
                        onSetPinned={handleSetPinned}
                      />
                    </li>
                  ) : (
                    <li
                      key={note.id}
                      className={cn(
                        NOTE_ROW_CLASS,
                        "group/note relative pr-9 transition-colors hover:bg-muted/60",
                        note.pinned && "font-semibold"
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
                        pending={pendingNoteId !== null}
                        onSetPinned={handleSetPinned}
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
                        value={editor.draft}
                        maxLength={500}
                        aria-label={t("workerNotePlaceholder")}
                        readOnly={editor.saving}
                        aria-busy={editor.saving}
                        className="h-6 border-0! py-0 text-sm leading-6 focus-visible:border-0!"
                        onChange={(event) => changeDraft(event.target.value)}
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
                      onClick={startCreating}
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
