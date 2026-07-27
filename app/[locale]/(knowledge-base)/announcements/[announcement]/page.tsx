import { AnnouncementDetail } from "@/components/announcements/announcement-detail"

export default async function Page({
  params,
}: {
  params: Promise<{ announcement: string }>
}) {
  const { announcement } = await params
  return <AnnouncementDetail announcementId={announcement} />
}
