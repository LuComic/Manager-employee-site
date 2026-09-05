"use client"

import { createElement, useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useRouter } from "@/i18n/navigation"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"

const historyGuardKey = "__workhalUnsavedChangesGuard"

type UnsavedChangesOptions = {
  dirty: boolean
  itemName: AppMessageKey
  toastId: string
  onDiscard: () => void
  onSaveDraft?: () => Promise<boolean>
}

export function useUnsavedChanges({
  dirty,
  itemName,
  toastId,
  onDiscard,
  onSaveDraft,
}: UnsavedChangesOptions) {
  const router = useRouter()
  const t = useAppTranslations()
  const dirtyRef = useRef(dirty)
  const onDiscardRef = useRef(onDiscard)
  const onSaveDraftRef = useRef(onSaveDraft)
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

  useEffect(() => {
    onSaveDraftRef.current = onSaveDraft
  }, [onSaveDraft])

  const showDiscardToast = useCallback(
    (discard: () => void, saveDraft?: () => Promise<void>) => {
      toast.warning(
        t("discardYourUnsavedItemNameChanges", {
          itemName: t(itemName),
        }),
        {
          id: toastId,
          className: "unsaved-changes-toast",
          description: createElement(
            "div",
            { className: "space-y-4" },
            createElement(
              "p",
              { className: "sm:pl-7" },
              t("yourChangesWillNotBeSaved")
            ),
            createElement(
              "div",
              {
                className: `grid gap-2 ${
                  saveDraft ? "sm:grid-cols-3" : "sm:grid-cols-2"
                }`,
              },
              saveDraft
                ? createElement(
                    Button,
                    {
                      type: "button",
                      variant: "secondary",
                      size: "sm",
                      className: "w-full",
                      onClick: () => void saveDraft(),
                    },
                    t("saveAsDraft")
                  )
                : null,
              createElement(
                Button,
                {
                  type: "button",
                  variant: "outline",
                  size: "sm",
                  className: "w-full",
                  onClick: () => toast.dismiss(toastId),
                },
                t("noKeepEditing")
              ),
              createElement(
                Button,
                {
                  type: "button",
                  variant: "destructive",
                  size: "sm",
                  className: "w-full",
                  onClick: discard,
                },
                t("yesDiscard")
              )
            )
          ),
          classNames: {
            title: "sm:col-start-2 sm:col-end-5 sm:row-start-1",
            description: "sm:col-start-1 sm:col-end-5 sm:row-start-2",
          },
          duration: Infinity,
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

      showDiscardToast(
        () => {
          onDiscardRef.current()
          leaveWithoutPrompt(destination)
        },
        onSaveDraftRef.current
          ? async () => {
              try {
                const saved = await onSaveDraftRef.current?.()
                if (saved) leaveWithoutPrompt(destination)
              } catch {
                // The editor reports save failures and remains open for correction.
              }
            }
          : undefined
      )
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
      showDiscardToast(
        () => {
          toast.dismiss(toastId)
          allowHistoryNavigationRef.current = true
          guardActiveRef.current = false
          onDiscardRef.current()
          window.history.go(-2)
        },
        onSaveDraftRef.current
          ? async () => {
              try {
                const saved = await onSaveDraftRef.current?.()
                if (!saved) return
                toast.dismiss(toastId)
                allowHistoryNavigationRef.current = true
                guardActiveRef.current = false
                window.history.go(-2)
              } catch {
                // The editor reports save failures and remains open for correction.
              }
            }
          : undefined
      )
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
