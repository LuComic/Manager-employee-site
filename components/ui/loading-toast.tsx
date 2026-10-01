"use client"

import { useEffect, useId } from "react"
import { toast } from "sonner"
import { useAppTranslations } from "@/i18n/use-app-translations"

type Message = Parameters<ReturnType<typeof useAppTranslations>>[0]
const LOADING_TOAST_DELAY_MS = 1_500

export function LoadingToast({ message }: { message: Message }) {
  const t = useAppTranslations()
  const id = useId()
  const label = t(message)
  useEffect(() => {
    const timeout = setTimeout(() => {
      toast.loading(label, { id, duration: Infinity })
    }, LOADING_TOAST_DELAY_MS)
    return () => {
      clearTimeout(timeout)
      toast.dismiss(id)
    }
  }, [id, label])
  return null
}
