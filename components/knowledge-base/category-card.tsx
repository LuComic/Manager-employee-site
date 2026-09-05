import { useAppTranslations } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { CategoryIcon } from "@/lib/category-icons"
import type { Category } from "@/lib/knowledge-base"
import { areaStyles } from "@/lib/area-styles"

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
      className={`group flex items-start gap-4 border-l-2 bg-background p-4 transition-colors ${areaStyles.guides.rail} hover:bg-violet-50/70 active:bg-violet-100/70 dark:hover:bg-violet-950/30`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center ${areaStyles.guides.tile}`}
      >
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
