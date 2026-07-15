import { notFound } from "next/navigation"

import { GuideDetail } from "@/components/knowledge-base/guide-detail"
import { getGuide, guides } from "@/lib/knowledge-base"

export function generateStaticParams() {
  return guides.map((guide) => ({ guide: guide.id }))
}

export default async function GuidePage({ params }: { params: Promise<{ guide: string }> }) {
  const { guide: guideId } = await params
  const guide = getGuide(guideId)

  if (!guide) {
    notFound()
  }

  return <GuideDetail guide={guide} />
}
