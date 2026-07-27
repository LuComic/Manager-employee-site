import type { LucideIcon } from "lucide-react"
import { Link } from "@/i18n/navigation"

import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center border bg-background p-6 text-center">
      <span className="flex size-10 items-center justify-center bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold">
        <T>{title}</T>
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        <T>{description}</T>
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`${buttonVariants()} mt-4`}>
          <T>{actionLabel}</T>
        </Link>
      )}
    </div>
  )
}
