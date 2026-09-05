import { Children, Fragment, type ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type ManagerListItemProps = {
  icon: ReactNode
  title: ReactNode
  metadata?: readonly ReactNode[]
  description?: ReactNode
  actions?: ReactNode
  actionsClassName?: string
  titleAs?: "h2" | "h3"
  align?: "center" | "start"
  iconClassName?: string
  descriptionClassName?: string
  summaryHref?: string
  cardClassName?: string
}

export function ManagerListItem({
  icon,
  title,
  metadata,
  description,
  actions,
  actionsClassName,
  titleAs: Title = "h3",
  align = "center",
  iconClassName,
  descriptionClassName,
  summaryHref,
  cardClassName,
}: ManagerListItemProps) {
  const iconElement = (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary",
        iconClassName
      )}
    >
      {icon}
    </span>
  )
  const summaryElement = (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <Title className="font-semibold">{title}</Title>
        {Children.map(metadata, (item) =>
          item === null ? null : (
            <Fragment>
              <span aria-hidden="true" className="text-border">
                |
              </span>
              {item}
            </Fragment>
          )
        )}
      </div>
      {description !== undefined && (
        <p
          className={cn(
            "mt-1 text-sm text-muted-foreground",
            descriptionClassName
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
  return (
    <Card
      size="sm"
      className={cn(
        "shadow-none transition-colors",
        summaryHref && "has-[a[data-manager-summary-link]:hover]:bg-muted/40",
        cardClassName
      )}
    >
      <CardContent
        className={cn(
          "flex flex-col gap-4 sm:flex-row",
          align === "start" ? "sm:items-start" : "sm:items-center"
        )}
      >
        {summaryHref ? (
          <Link
            href={summaryHref}
            data-manager-summary-link
            className={cn(
              "flex min-w-0 flex-1 flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:flex-row",
              align === "start" ? "sm:items-start" : "sm:items-center"
            )}
          >
            {iconElement}
            {summaryElement}
          </Link>
        ) : (
          <>
            {iconElement}
            {summaryElement}
          </>
        )}
        {actions && (
          <div
            className={cn("flex shrink-0 flex-wrap gap-2", actionsClassName)}
          >
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
