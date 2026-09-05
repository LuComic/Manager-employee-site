import type { LucideIcon } from "lucide-react"
import { Link } from "@/i18n/navigation"

import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import type { AppMessageKey } from "@/i18n/messages"
import { AreaIconTile } from "@/components/operations/area-icon-tile"
import { areaStyles, type AreaKey } from "@/lib/area-styles"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  area,
}: {
  icon: LucideIcon
  title: AppMessageKey
  description: AppMessageKey
  actionLabel?: AppMessageKey
  actionHref?: string
  area?: AreaKey
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center border border-l-2 bg-background p-6 text-center",
        area ? areaStyles[area].rail : "border-l-border"
      )}
    >
      {area ? (
        <AreaIconTile area={area} icon={Icon} />
      ) : (
        <span className="flex size-10 items-center justify-center bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
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
