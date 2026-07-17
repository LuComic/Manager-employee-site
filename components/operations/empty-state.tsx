import type { LucideIcon } from "lucide-react"
import Link from "next/link"

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
    <div className="flex min-h-48 flex-col items-center justify-center border bg-background p-8 text-center">
      <span className="flex size-12 items-center justify-center bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={`${buttonVariants()} mt-4`}>
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
