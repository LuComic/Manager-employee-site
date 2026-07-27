import { GuideEditor } from "@/components/manager/guide-editor"

export default async function Page({
  params,
}: {
  params: Promise<{ guide: string }>
}) {
  const { guide } = await params
  return <GuideEditor guideId={guide} />
}
