import { notFound } from "next/navigation"

import { GuideCard } from "@/components/knowledge-base/guide-card"
import {
  categories,
  getCategory,
  getGuidesForCategory,
  type CategoryId,
} from "@/lib/knowledge-base"

export function generateStaticParams() {
  return categories.map((category) => ({ category: category.id }))
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category: categoryId } = await params
  const category = getCategory(categoryId)

  if (!category) {
    notFound()
  }

  const categoryGuides = getGuidesForCategory(category.id as CategoryId)
  const Icon = category.icon

  return (
    <div>
      <div className="flex max-w-3xl items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {category.label}
          </h1>
          <p className="mt-4 text-muted-foreground">{category.description}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categoryGuides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </div>
  )
}
