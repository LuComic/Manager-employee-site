import { GuidePageContent } from "@/components/knowledge-base/guide-page-content"
import { guides } from "@/lib/knowledge-base"

export function generateStaticParams() {
  return guides.map((guide) => ({ guide: guide.id }))
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ guide: string }>
}) {
  const { guide } = await params
  return <GuidePageContent guideId={guide} />
}
