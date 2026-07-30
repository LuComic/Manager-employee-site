"use client"

import { Settings2 } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
import type { AppMessageKey } from "@/i18n/messages"
import type { WorkerEditableSection } from "@/lib/worker-editing"

export function ManageSectionButton({
  section,
  href,
  label,
}: {
  section: WorkerEditableSection
  href: string
  label: AppMessageKey
}) {
  const { hub, managerAccess } = useOperations()

  if (!managerAccess || !hub?.workersCanEdit[section]) return null

  return (
    <Link
      href={href}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <Settings2 /> <T>{label}</T>
    </Link>
  )
}
