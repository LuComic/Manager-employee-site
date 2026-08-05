"use client"

import { useState } from "react"
import { UserRoundPen } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Button } from "@/components/ui/button"
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"
import type { WorkerEditableSection } from "@/lib/worker-editing"

const sectionLabelKeys = {
  guides: "guides",
  events: "calendarEvents",
  announcements: "announcements",
  documents: "documents",
  faqs: "commonQuestions",
} satisfies Record<WorkerEditableSection, AppMessageKey>

export function WorkersCanEditToggle({
  section,
  size = "default",
  appearance = "button",
}: {
  section: WorkerEditableSection
  size?: "default" | "sm"
  appearance?: "button" | "menu-item"
}) {
  const t = useAppTranslations()
  const { hub, canCreateContent, setWorkersCanEdit, showFeedback } =
    useOperations()
  const [pending, setPending] = useState(false)

  if (!hub || !canCreateContent) return null

  const enabled = hub.workersCanEdit[section]
  const sectionLabel = t(sectionLabelKeys[section])

  async function changeEnabled(nextEnabled: boolean) {
    setPending(true)
    try {
      await setWorkersCanEdit(section, nextEnabled)
      showFeedback(
        nextEnabled ? "workersCanEditEnabled" : "workersCanEditDisabled",
        { section: sectionLabel },
        "neutral"
      )
    } finally {
      setPending(false)
    }
  }

  if (appearance === "menu-item") {
    return (
      <DropdownMenuCheckboxItem
        checked={enabled}
        disabled={pending}
        onCheckedChange={changeEnabled}
        className={
          enabled
            ? "bg-primary text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground focus:**:text-primary-foreground"
            : undefined
        }
      >
        <UserRoundPen /> <T>workersCanEdit</T>
      </DropdownMenuCheckboxItem>
    )
  }

  return (
    <Button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={t("workersCanEditSection", { section: sectionLabel })}
      variant={enabled ? "default" : "outline"}
      size={size}
      disabled={pending}
      onClick={() => changeEnabled(!enabled)}
    >
      <UserRoundPen /> <T>workersCanEdit</T>
    </Button>
  )
}
