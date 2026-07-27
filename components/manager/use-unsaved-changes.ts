"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import { useRouter } from "@/i18n/navigation"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"

const historyGuardKey = "__operationsUnsavedChangesGuard"

type UnsavedChangesOptions = {
  dirty: boolean
  itemName: AppMessageKey
  toastId: string
  onDiscard: () => void
}

export function useUnsavedChanges({
  dirty,
  itemName,
  toastId,
  onDiscard,
}: UnsavedChangesOptions) {
  const router = useRouter()
  const t = useAppTranslations()
  const dirtyRef = useRef(dirty)
  const onDiscardRef = useRef(onDiscard)
  const guardActiveRef = useRef(false)
  const allowHistoryNavigationRef = useRef(false)
  const guardStateRef = useRef<unknown>(null)
  const editorUrlRef = useRef("")

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    onDiscardRef.current = onDiscard
  }, [onDiscard])

  const showDiscardToast = useCallback(
    (discard: () => void) => {
      toast.warning(
        t("discardYourUnsavedItemNameChanges", {
          itemName: t(itemName),
        }),
        {
          id: toastId,
          description: t("yourChangesWillNotBeSaved"),
          duration: Infinity,
          cancel: {
            label: t("noKeepEditing"),
            onClick: () => undefined,
          },
          action: {
            label: t("yesDiscard"),
            onClick: discard,
          },
        }
      )
    },
    [itemName, t, toastId]
  )

  const leaveWithoutPrompt = useCallback(
    (destination: string) => {
      toast.dismiss(toastId)
      if (!guardActiveRef.current) {
        router.push(destination)
        return
      }

      allowHistoryNavigationRef.current = true
      window.addEventListener(
        "popstate",
        () => {
          guardActiveRef.current = false
          router.push(destination)
        },
        { once: true }
      )
      window.history.back()
    },
    [router, toastId]
  )

  const requestLeave = useCallback(
    (destination: string) => {
      if (!dirtyRef.current) {
        leaveWithoutPrompt(destination)
        return
      }

      showDiscardToast(() => {
        onDiscardRef.current()
        leaveWithoutPrompt(destination)
      })
    },
    [leaveWithoutPrompt, showDiscardToast]
  )

  useEffect(() => {
    if (!dirty || guardActiveRef.current) return

    const currentState = window.history.state
    const guardState =
      typeof currentState === "object" && currentState !== null
        ? { ...currentState, [historyGuardKey]: toastId }
        : { [historyGuardKey]: toastId }

    guardStateRef.current = guardState
    editorUrlRef.current = window.location.href
    guardActiveRef.current = true
    allowHistoryNavigationRef.current = false
    window.history.pushState(guardState, "", editorUrlRef.current)

    function handlePopState() {
      if (
        allowHistoryNavigationRef.current ||
        !dirtyRef.current ||
        !guardActiveRef.current
      )
        return

      window.history.pushState(guardStateRef.current, "", editorUrlRef.current)
      showDiscardToast(() => {
        toast.dismiss(toastId)
        allowHistoryNavigationRef.current = true
        guardActiveRef.current = false
        onDiscardRef.current()
        window.history.go(-2)
      })
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [dirty, showDiscardToast, toastId])

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      event.preventDefault()
    }

    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [])

  return { leaveWithoutPrompt, requestLeave }
}
