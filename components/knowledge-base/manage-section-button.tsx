"use client"

import { Plus, Settings2 } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import type { AppMessageKey } from "@/i18n/messages"
import { Link } from "@/i18n/navigation"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { cn } from "@/lib/utils"
import type { WorkerEditableSection } from "@/lib/worker-editing"

export function ManageSectionButton({
  section,
  href,
  size = "default",
}: {
  section: WorkerEditableSection
  href: string
  size?: "default" | "sm"
}) {
  const { hub, managerAccess } = useOperations()

  if (!managerAccess || !hub?.workersCanEdit[section]) return null

  return (
    <Link href={href} className={buttonVariants({ size })}>
      <Settings2 data-icon="inline-start" /> <T>manage</T>
    </Link>
  )
}

export function CreateSectionButton({
  section,
  href,
  label,
}: {
  section: WorkerEditableSection
  href: string
  label: AppMessageKey
}) {
  const { hub, managerAccess } = useOperations()
  const t = useAppTranslations()

  if (!managerAccess || !hub?.workersCanEdit[section]) return null

  return (
    <Link
      href={href}
      className={cn(buttonVariants({ size: "icon-sm" }), "size-9 min-h-0")}
      aria-label={t(label)}
    >
      <Plus />
    </Link>
  )
}
