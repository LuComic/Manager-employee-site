"use client"

import { BookOpen } from "lucide-react"

import { CategoryCard } from "@/components/knowledge-base/category-card"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { SectionHeading } from "@/components/knowledge-base/section-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { useOperations } from "@/components/providers/operations-provider"

export default function GuidesPage() {
  const t = useAppTranslations()
  const { guideCategories, guides } = useOperations()
  const publishedGuides = guides.filter((guide) => guide.published)

  return (
    <div className="space-y-6">
      <PageHeading
        title="guides"
        description="clearStepStepInstructionsTasksComeUpMessage"
      />
      <section>
        <SectionHeading
          title="byWorkArea"
          description="chooseAreaBestMatchesTaskFront"
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
            icon={BookOpen}
            title="noGuideCategories"
            description="workAreasAppearHereManagerCreates"
          />
        )}
      </section>
      <section>
        <SectionHeading
          title="allGuides"
          descriptionText={t("countPublishedGuidesAvailable", {
            count: publishedGuides.length,
          })}
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
            title="noPublishedGuides"
            description="publishedGuidesWillAppearHere"
          />
        )}
      </section>
    </div>
  )
}
