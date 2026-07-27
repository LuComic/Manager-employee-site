import { Link } from "@/i18n/navigation"
import { ArrowRight } from "lucide-react"

import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import type { AppMessageKey } from "@/i18n/messages"

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: AppMessageKey
  description?: string
  action?: { label: AppMessageKey; href: string }
}) {
  return (
    <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          <T>{title}</T>
        </h2>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">
            <T>{description}</T>
          </p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <T>{action.label}</T> <ArrowRight />
        </Link>
      )}
    </div>
  )
}
