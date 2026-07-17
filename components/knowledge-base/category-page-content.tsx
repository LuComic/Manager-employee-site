"use client"

import { BookOpen } from "lucide-react"

import { EmptyState } from "@/components/operations/empty-state"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { useOperations } from "@/components/providers/operations-provider"
import { CategoryIcon } from "@/lib/category-icons"

export function CategoryPageContent({ categoryId }: { categoryId: string }) {
  const { categories, guides } = useOperations()
  const category = categories.find((item) => item.id === categoryId)
  if (!category)
    return (
      <EmptyState
        icon={BookOpen}
        title="Category not found"
        description="Choose another guide category from the navigation."
      />
    )
  const categoryGuides = guides.filter(
    (guide) => guide.published && guide.category === category.id
  )
  return (
    <div>
      <div className="flex max-w-3xl items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center bg-primary/10 text-primary">
          <CategoryIcon iconKey={category.iconKey} className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {category.label}
          </h1>
          <p className="mt-4 text-muted-foreground">{category.description}</p>
        </div>
      </div>
      {categoryGuides.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categoryGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={BookOpen}
            title="No published guides"
            description="Published guides in this category will appear here."
          />
        </div>
      )}
    </div>
  )
}
