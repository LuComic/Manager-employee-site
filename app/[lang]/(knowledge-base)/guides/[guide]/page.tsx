import { GuidePageContent } from "@/components/knowledge-base/guide-page-content"

export default async function GuidePage({
  params,
}: {
  params: Promise<{ guide: string }>
}) {
  const { guide } = await params
  return <GuidePageContent guideId={guide} />
}
