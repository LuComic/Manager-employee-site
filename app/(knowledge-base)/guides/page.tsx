"use client"

import { BookOpen } from "lucide-react"

import { CategoryCard } from "@/components/knowledge-base/category-card"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { SectionHeading } from "@/components/knowledge-base/section-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"

export default function GuidesPage() {
  const { categories, guides } = useOperations()
  const publishedGuides = guides.filter((guide) => guide.published)

  return (
    <div className="space-y-6">
      <PageHeading
        title="Guides"
        description="Clear, step-by-step instructions for the tasks that come up during a shift."
      />
      <section>
        <SectionHeading
          title="Browse by work area"
          description="Choose the area that best matches the task in front of you."
        />
        {categories.length ? (
          <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
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
            icon={BookOpen}
            title="No guide categories"
            description="Work areas will appear here when a manager creates them."
          />
        )}
      </section>
      <section>
        <SectionHeading
          title="All guides"
          description={`${publishedGuides.length} published guides available.`}
        />
        {publishedGuides.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {publishedGuides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No published guides"
            description="Published guides will appear here."
          />
        )}
      </section>
    </div>
  )
}
