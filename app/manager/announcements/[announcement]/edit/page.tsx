import { AnnouncementEditor } from "@/components/manager/announcement-editor"

export default async function Page({
  params,
}: {
  params: Promise<{ announcement: string }>
}) {
  const { announcement } = await params
  return <AnnouncementEditor announcementId={announcement} />
}
