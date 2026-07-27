import { EventEditor } from "@/components/manager/event-editor"

export default async function Page({
  params,
}: {
  params: Promise<{ event: string }>
}) {
  const { event } = await params
  return <EventEditor eventId={event} />
}
