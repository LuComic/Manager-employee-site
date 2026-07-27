import { useAppTranslations } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { CategoryIcon } from "@/lib/category-icons"
import type { Category } from "@/lib/knowledge-base"

export function CategoryCard({
  category,
  count = 0,
}: {
  category: Category
  count?: number
}) {
  const t = useAppTranslations()

  return (
    <Link
      href={`/categories/${category.id}`}
      className="group flex items-start gap-4 bg-background p-4 transition-colors hover:bg-muted/60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
        <CategoryIcon iconKey={category.iconKey} className="size-5" />
      </span>
      <span>
        <span className="flex items-center gap-2 font-semibold">
          {category.label}
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </span>
        <span className="mt-2 block text-sm text-muted-foreground">
          {category.description}
        </span>
        <Badge variant="secondary" className="mt-3">
          {t(count === 1 ? "guideCountSingular" : "guideCountPlural", {
            count,
          })}
        </Badge>
      </span>
    </Link>
  )
}
