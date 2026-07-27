"use client"

import { BookOpen } from "lucide-react"

import { EmptyState } from "@/components/operations/empty-state"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"

export function CategoryPageContent({ categoryId }: { categoryId: string }) {
  const { categories, guides } = useOperations()
  const category = categories.find((item) => item.id === categoryId)
  if (!category)
    return (
      <EmptyState
        icon={BookOpen}
        title="categoryNotFound"
        description="chooseGuideCategoryNavigation"
      />
    )
  const categoryGuides = guides.filter(
    (guide) => guide.published && guide.category === category.id
  )
  return (
    <div>
      <PageHeading title={category.label} description={category.description} />
      {categoryGuides.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categoryGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={BookOpen}
            title="noPublishedGuides"
            description="publishedGuidesCategoryAppearHere"
          />
        </div>
      )}
    </div>
  )
}
