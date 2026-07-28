"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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
  const [isSaving, setIsSaving] = useState(false)
  const activeHubRef = useRef(hubId)
  const loadedHubRef = useRef<Id<"hubs"> | undefined>(undefined)
  const draftRef = useRef("")
  const savedTextRef = useRef("")
  const dirtyRef = useRef(false)
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
      setIsSaving(false)
    }
    if (dirtyRef.current) return

    draftRef.current = remoteText
    savedTextRef.current = remoteText
    setDraft(remoteText)
  }, [hubId, remoteText])

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current)
  }, [hubId])

  const saveNow = useCallback(async () => {
    clearTimeout(timeoutRef.current)
    if (!hubId || savingHubRef.current === hubId) return

    savingHubRef.current = hubId
    setIsSaving(true)
    try {
      while (
        activeHubRef.current === hubId &&
        draftRef.current !== savedTextRef.current
      ) {
        const text = draftRef.current
        try {
          await saveWorkerNotes({ hubId, text })
        } catch (error) {
          toast.error(translateError(error))
          break
        }
        savedTextRef.current = text
      }
      dirtyRef.current = draftRef.current !== savedTextRef.current
    } finally {
      if (savingHubRef.current === hubId) savingHubRef.current = undefined
      if (activeHubRef.current === hubId) setIsSaving(false)
    }
  }, [hubId, saveWorkerNotes, translateError])

  function changeDraft(text: string) {
    clearTimeout(timeoutRef.current)
    draftRef.current = text
    dirtyRef.current =
      text !== savedTextRef.current || savingHubRef.current === hubId
    setDraft(text)

    if (dirtyRef.current) {
      timeoutRef.current = setTimeout(() => void saveNow(), AUTOSAVE_DELAY_MS)
    }
  }

  return { draft, isSaving, changeDraft, saveNow }
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
  const { draft, isSaving, changeDraft, saveNow } = useAutosavedWorkerNotes({
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
            <Textarea
              value={draft}
              maxLength={MAX_NOTES_LENGTH}
              disabled={remoteText === undefined}
              aria-label={t("workerNotePlaceholder")}
              aria-busy={isSaving}
              placeholder={
                remoteText === undefined
                  ? t("loadingWorkersNotes")
                  : t("workerNotePlaceholder")
              }
              className="h-full min-h-0 flex-1 resize-none rounded-md border border-input bg-background px-3 py-3 leading-6 focus-visible:border-ring"
              onChange={(event) => changeDraft(event.target.value)}
              onBlur={saveNow}
            />
            {isSaving && (
              <p className="mt-2 text-xs text-muted-foreground" role="status">
                {t("saving")}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
