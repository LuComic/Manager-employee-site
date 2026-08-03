export type CategoryKind = "guide" | "event"
export const RESERVATION_EVENT_TYPE_ID = "event-reservation"
export const DEPUTY_SCHEDULES_EVENT_TYPE_ID = "deputy-schedules"

export type CategoryLike = {
  id: string
  label: string
  kind: CategoryKind
}

export function eventCategoryLabel(
  value: string,
  eventTypes: readonly CategoryLike[]
) {
  return eventTypes.find((eventType) => eventType.id === value)?.label ?? value
}
