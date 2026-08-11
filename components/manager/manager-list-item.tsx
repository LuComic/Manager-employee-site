import { Children, Fragment, type ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
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
}: ManagerListItemProps) {
  return (
    <Card size="sm" className="shadow-none">
      <CardContent
        className={cn(
          "flex flex-col gap-4 sm:flex-row",
          align === "start" ? "sm:items-start" : "sm:items-center"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary",
            iconClassName
          )}
        >
          {icon}
        </span>
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
