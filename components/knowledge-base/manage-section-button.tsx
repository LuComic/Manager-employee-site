"use client"

import { Settings2 } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import { Link } from "@/i18n/navigation"
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
