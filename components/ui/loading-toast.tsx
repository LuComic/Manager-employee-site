"use client"

import { useEffect, useId } from "react"
import { toast } from "sonner"
import { useAppTranslations } from "@/i18n/use-app-translations"

type Message = Parameters<ReturnType<typeof useAppTranslations>>[0]

export function LoadingToast({ message }: { message: Message }) {
  const t = useAppTranslations()
  const id = useId()
  const label = t(message)
  useEffect(() => {
    toast.loading(label, { id, duration: Infinity })
    return () => {
      toast.dismiss(id)
    }
  }, [id, label])
  return null
}
