"use client"

import { BookOpen } from "lucide-react"

import { CategoryCard } from "@/components/knowledge-base/category-card"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"

export default function CategoriesPage() {
  const { guideCategories, guides } = useOperations()
  const publishedGuides = guides.filter((guide) => guide.published)

  return (
    <div className="space-y-6">
      <PageHeading
        area="guides"
        title="guideCategories"
        description="chooseWorkAreaSeeAllPublishedGuides"
      />

      {guideCategories.length ? (
        <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 xl:grid-cols-3">
          {guideCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              count={
                publishedGuides.filter(
                  (guide) => guide.category === category.id
                ).length
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          area="guides"
          icon={BookOpen}
          title="noGuideCategories"
          description="workAreasAppearHereManagerCreates"
        />
      )}
    </div>
  )
}
