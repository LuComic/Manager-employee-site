import { Link } from "@/i18n/navigation"
import { ArrowRight, Clock3 } from "lucide-react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Guide } from "@/lib/knowledge-base"
import { AreaIconTile } from "@/components/operations/area-icon-tile"
import { areaStyles } from "@/lib/area-styles"

export function GuideCard({
  guide,
  onNavigate,
}: {
  guide: Guide
  onNavigate?: () => void
}) {
  const Icon = guide.icon

  return (
    <Link
      href={`/guides/${guide.id}`}
      onClick={onNavigate}
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card
        size="sm"
        className={`h-full border-l-2 shadow-none transition-all group-hover:-translate-y-0.5 group-active:translate-y-0 ${areaStyles.guides.rail} ${areaStyles.guides.hover}`}
      >
        <CardHeader>
          <AreaIconTile area="guides" icon={Icon} className="mb-2 size-9" />
          <CardTitle className="text-base tracking-normal normal-case">
            {guide.title}
          </CardTitle>
          <CardDescription>{guide.description}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto justify-between">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-4" /> {guide.duration}
          </span>
          <span className="flex size-9 items-center justify-center text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground">
            <ArrowRight className="size-4" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
