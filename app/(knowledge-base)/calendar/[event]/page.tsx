import { EventDetail } from "@/components/calendar/event-detail"

export default async function Page({
  params,
}: {
  params: Promise<{ event: string }>
}) {
  const { event } = await params
  return <EventDetail eventId={event} />
}
