"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { StickyNote, X } from "lucide-react"
import { toast } from "sonner"

import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import {
  useAppErrorTranslation,
  useAppTranslations,
} from "@/i18n/use-app-translations"

import { useWorkerNotesWindow } from "./use-worker-notes-window"

const AUTOSAVE_DELAY_MS = 700
const AUTOSAVE_RETRY_DELAY_MS = 3_000
const MAX_NOTES_LENGTH = 10_000

function useAutosavedWorkerNotes({
  hubId,
  remoteText,
}: {
  hubId: Id<"hubs"> | undefined
  remoteText: string | undefined
}) {
  const translateError = useAppErrorTranslation()
  const saveWorkerNotes = useMutation(api.workerNotes.save)
  const [draft, setDraft] = useState("")
  const [conflictText, setConflictText] = useState<string | null>(null)
  const activeHubRef = useRef(hubId)
  const loadedHubRef = useRef<Id<"hubs"> | undefined>(undefined)
  const draftRef = useRef("")
  const savedTextRef = useRef("")
  const conflictTextRef = useRef<string | null>(null)
  const pendingRemoteTextRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)
  const saveErrorShownRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const savingHubRef = useRef<Id<"hubs"> | undefined>(undefined)

  useEffect(() => {
    activeHubRef.current = hubId
  }, [hubId])

  useEffect(() => {
    if (remoteText === undefined) return
    if (loadedHubRef.current !== hubId) {
      loadedHubRef.current = hubId
      dirtyRef.current = false
      conflictTextRef.current = null
      pendingRemoteTextRef.current = null
      saveErrorShownRef.current = false
      setConflictText(null)
    }
    if (dirtyRef.current) {
      pendingRemoteTextRef.current =
        remoteText === savedTextRef.current ? null : remoteText
      if (
        conflictTextRef.current !== null &&
        conflictTextRef.current !== remoteText
      ) {
        conflictTextRef.current = remoteText
        setConflictText(remoteText)
      }
      return
    }

    pendingRemoteTextRef.current = null
    draftRef.current = remoteText
    savedTextRef.current = remoteText
    setDraft(remoteText)
  }, [hubId, remoteText])

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [hubId])

  async function saveNow() {
    clearTimeout(timeoutRef.current)
    if (
      !hubId ||
      activeHubRef.current !== hubId ||
      savingHubRef.current === hubId ||
      conflictTextRef.current !== null
    ) {
      return
    }

    savingHubRef.current = hubId
    try {
      while (
        activeHubRef.current === hubId &&
        draftRef.current !== savedTextRef.current
      ) {
        const text = draftRef.current
        const expectedText = savedTextRef.current
        try {
          const result = await saveWorkerNotes({ hubId, text, expectedText })
          if (result.status === "conflict") {
            conflictTextRef.current = result.currentText
            pendingRemoteTextRef.current = null
            saveErrorShownRef.current = false
            setConflictText(result.currentText)
            break
          }
        } catch (error) {
          if (!saveErrorShownRef.current) {
            saveErrorShownRef.current = true
            toast.error(translateError(error))
          }
          if (
            activeHubRef.current === hubId &&
            conflictTextRef.current === null &&
            draftRef.current !== savedTextRef.current
          ) {
            timeoutRef.current = setTimeout(
              () => void saveNow(),
              AUTOSAVE_RETRY_DELAY_MS
            )
          }
          break
        }
        savedTextRef.current = text
        if (pendingRemoteTextRef.current === text) {
          pendingRemoteTextRef.current = null
        }
        conflictTextRef.current = null
        saveErrorShownRef.current = false
        setConflictText(null)
      }
      dirtyRef.current = draftRef.current !== savedTextRef.current
      const pendingRemoteText = pendingRemoteTextRef.current
      if (
        activeHubRef.current === hubId &&
        !dirtyRef.current &&
        conflictTextRef.current === null &&
        pendingRemoteText !== null &&
        pendingRemoteText !== savedTextRef.current
      ) {
        draftRef.current = pendingRemoteText
        savedTextRef.current = pendingRemoteText
        setDraft(pendingRemoteText)
      }
      pendingRemoteTextRef.current = null
    } finally {
      if (savingHubRef.current === hubId) savingHubRef.current = undefined
    }
  }

  function changeDraft(text: string) {
    clearTimeout(timeoutRef.current)
    draftRef.current = text
    dirtyRef.current =
      text !== savedTextRef.current || savingHubRef.current === hubId
    setDraft(text)

    if (dirtyRef.current) {
      if (conflictTextRef.current === null) {
        timeoutRef.current = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS)
      }
    }
  }

  function loadLatest() {
    const latestText = conflictTextRef.current
    if (latestText === null) return

    clearTimeout(timeoutRef.current)
    draftRef.current = latestText
    savedTextRef.current = latestText
    conflictTextRef.current = null
    pendingRemoteTextRef.current = null
    dirtyRef.current = false
    saveErrorShownRef.current = false
    setDraft(latestText)
    setConflictText(null)
  }

  function overwriteWithDraft() {
    const latestText = conflictTextRef.current
    if (latestText === null) return

    savedTextRef.current = latestText
    conflictTextRef.current = null
    pendingRemoteTextRef.current = null
    dirtyRef.current = draftRef.current !== latestText
    saveErrorShownRef.current = false
    setConflictText(null)
    if (dirtyRef.current) void saveNow()
  }

  return {
    draft,
    conflictText,
    changeDraft,
    saveNow,
    loadLatest,
    overwriteWithDraft,
  }
}

export function WorkerNotes() {
  const t = useAppTranslations()
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
  const [now, setNow] = useState(() => Date.now())
  const isMemberView =
    isDesktop &&
    isAuthenticated &&
    !searchParams.get("hub") &&
    Boolean(activeHubId) &&
    restored

  const remoteText = useQuery(
    api.workerNotes.get,
    isMemberView && isOpen && hub ? { hubId: hub.id, now } : "skip"
  )
  const {
    draft,
    conflictText,
    changeDraft,
    saveNow,
    loadLatest,
    overwriteWithDraft,
  } = useAutosavedWorkerNotes({
    hubId: activeHubId,
    remoteText,
  })

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, setIsOpen])

  if (!isMemberView || !hub) return null

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

          <div className="flex min-h-0 flex-1 flex-col px-6 py-6">
            {conflictText !== null && (
              <div
                className="mb-4 border border-destructive/40 bg-destructive/5 p-3 text-sm"
                role="alert"
              >
                <p>{t("workerNotesChanged")}</p>
                <p className="mt-3 font-medium">
                  {t("workerNotesLatestVersion")}
                </p>
                <pre className="mt-1 max-h-24 overflow-auto bg-background p-2 font-sans text-xs whitespace-pre-wrap">
                  {conflictText}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={loadLatest}>
                    {t("loadLatestWorkerNotes")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={overwriteWithDraft}
                  >
                    {t("overwriteWorkerNotes")}
                  </Button>
                </div>
              </div>
            )}
            <Textarea
              value={draft}
              maxLength={MAX_NOTES_LENGTH}
              disabled={remoteText === undefined}
              aria-label={t("workerNotePlaceholder")}
              placeholder={
                remoteText === undefined
                  ? t("loadingWorkersNotes")
                  : t("workerNotePlaceholder")
              }
              className="h-full min-h-0 flex-1 resize-none border-0! p-0! leading-6 focus-visible:border-0!"
              onChange={(event) => changeDraft(event.target.value)}
              onBlur={saveNow}
            />
          </div>
        </div>
      )}
    </>
  )
}
