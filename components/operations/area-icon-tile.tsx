import type { LucideIcon } from "lucide-react"

import { areaStyles, type AreaKey } from "@/lib/area-styles"
import { cn } from "@/lib/utils"

export function AreaIconTile({
  area,
  icon,
  className,
}: {
  area: AreaKey
  icon?: LucideIcon
  className?: string
}) {
  const style = areaStyles[area]
  const Icon = icon ?? style.icon

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center",
        style.tile,
        className
      )}
    >
      <Icon className="size-5" />
    </span>
  )
}
