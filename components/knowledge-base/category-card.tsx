import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { Category } from "@/lib/knowledge-base"

export function CategoryCard({
  category,
  count = 0,
}: {
  category: Category
  count?: number
}) {
  const Icon = category.icon

  return (
    <Link
      href={`/categories/${category.id}`}
      className="group flex min-h-32 items-start gap-4 bg-background p-6 transition-colors hover:bg-muted/60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="flex items-center gap-2 font-semibold">
          {category.label}
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </span>
        <span className="mt-2 block text-sm text-muted-foreground">
          {category.description}
        </span>
        <Badge variant="secondary" className="mt-4">
          {count} guides
        </Badge>
      </span>
    </Link>
  )
}
