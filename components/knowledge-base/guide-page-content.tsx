"use client"

import { BookOpen } from "lucide-react"

import { GuideDetail } from "@/components/knowledge-base/guide-detail"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"

export function GuidePageContent({ guideId }: { guideId: string }) {
  const { guideCategories, guides } = useOperations()
  const guide = guides.find((item) => item.id === guideId && item.published)
  if (!guide)
    return (
      <EmptyState
        area="guides"
        icon={BookOpen}
        title="guideNotAvailable"
        description="guideUnpublishedRemovedBrowseCurrentGuidesFind"
      />
    )
  const relatedGuides = guides.filter(
    (item) =>
      item.published &&
      item.id !== guide.id &&
      (guide.relatedGuideIds ?? []).includes(item.id)
  )
  return (
    <GuideDetail
      guide={guide}
      category={guideCategories.find((item) => item.id === guide.category)}
      relatedGuides={relatedGuides}
    />
  )
}
