import Link from "next/link"
import { ArrowRight, Clock3 } from "lucide-react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Guide } from "@/lib/knowledge-base"

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
        className="h-full shadow-none transition-colors group-hover:bg-muted/40"
      >
        <CardHeader>
          <span className="mb-2 flex size-9 items-center justify-center bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
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
