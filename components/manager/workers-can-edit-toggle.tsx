"use client"

import { useState } from "react"
import { UserRoundPen } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Button } from "@/components/ui/button"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"
import type { WorkerEditableSection } from "@/lib/worker-editing"

const sectionLabelKeys = {
  guides: "guides",
  events: "calendarEvents",
  announcements: "announcements",
  documents: "documents",
} satisfies Record<WorkerEditableSection, AppMessageKey>

export function WorkersCanEditToggle({
  section,
  size = "default",
}: {
  section: WorkerEditableSection
  size?: "default" | "sm"
}) {
  const t = useAppTranslations()
  const { hub, canCreateContent, setWorkersCanEdit, showFeedback } =
    useOperations()
  const [pending, setPending] = useState(false)

  if (!hub || !canCreateContent) return null

  const enabled = hub.workersCanEdit[section]
  const sectionLabel = t(sectionLabelKeys[section])

  return (
    <Button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={t("workersCanEditSection", { section: sectionLabel })}
      variant={enabled ? "selected" : "outline"}
      size={size}
      disabled={pending}
      onClick={async () => {
        setPending(true)
        try {
          await setWorkersCanEdit(section, !enabled)
          showFeedback(
            enabled ? "workersCanEditDisabled" : "workersCanEditEnabled",
            { section: sectionLabel }
          )
        } finally {
          setPending(false)
        }
      }}
    >
      <UserRoundPen /> <T>workersCanEdit</T>
    </Button>
  )
}
