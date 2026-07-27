import { LocalizedLink as Link } from "@/components/localized-link"
import { ArrowRight } from "lucide-react"

import { T, useI18n } from "@/components/providers/i18n-provider"
import { buttonVariants } from "@/components/ui/button"

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: { label: string; href: string }
}) {
  const { href } = useI18n()

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
          href={href(action.href)}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <T>{action.label}</T> <ArrowRight />
        </Link>
      )}
    </div>
  )
}
