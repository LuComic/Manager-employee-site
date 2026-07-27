"use client"

import { BookOpen } from "lucide-react"

import { GuideDetail } from "@/components/knowledge-base/guide-detail"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"

export function GuidePageContent({ guideId }: { guideId: string }) {
  const { categories, guides } = useOperations()
  const guide = guides.find((item) => item.id === guideId && item.published)
  if (!guide)
    return (
      <EmptyState
        icon={BookOpen}
        title="guideNotAvailable"
        description="guideUnpublishedRemovedBrowseCurrentGuidesFind"
      />
    )
  return (
    <GuideDetail
      guide={guide}
      category={categories.find((item) => item.id === guide.category)}
    />
  )
}
