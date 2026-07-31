import type { AppMessageKey } from "@/i18n/messages"

export type CategoryKind = "guide" | "event"
export type EventTypeMessageKey =
  "reservation" | "training" | "maintenance" | "inspection" | "openingHours"

export const defaultEventTypeDefinitions = [
  {
    id: "event-reservation",
    legacyValue: "Reservation",
    label: "Reservation",
    messageKey: "reservation",
  },
  {
    id: "event-training",
    legacyValue: "Training",
    label: "Training",
    messageKey: "training",
  },
  {
    id: "event-maintenance",
    legacyValue: "Maintenance",
    label: "Maintenance",
    messageKey: "maintenance",
  },
  {
    id: "event-inspection",
    legacyValue: "Inspection",
    label: "Inspection",
    messageKey: "inspection",
  },
  {
    id: "event-opening-hours",
    legacyValue: "Opening hours",
    label: "Opening hours",
    messageKey: "openingHours",
  },
] as const satisfies readonly {
  id: string
  legacyValue: string
  label: string
  messageKey: EventTypeMessageKey
}[]

export type CategoryLike = {
  id: string
  label: string
  kind: CategoryKind
  systemLabelKey?: EventTypeMessageKey
}

export const virtualDefaultEventTypes = defaultEventTypeDefinitions.map(
  (definition) => ({
    id: definition.id,
    label: definition.label,
    description: "",
    iconKey: "general" as const,
    kind: "event" as const,
    systemLabelKey: definition.messageKey,
  })
)

export function categoryLabel(
  category: CategoryLike,
  translate: (key: AppMessageKey) => string
) {
  return category.systemLabelKey
    ? translate(category.systemLabelKey)
    : category.label
}

export function normalizeEventCategory(
  value: string,
  eventTypes: readonly CategoryLike[] = []
) {
  const exact = eventTypes.find((eventType) => eventType.id === value)
  if (exact) return exact.id

  const definition = defaultEventTypeDefinitions.find(
    (item) =>
      item.id === value ||
      item.legacyValue.toLowerCase() === value.trim().toLowerCase()
  )
  if (definition) {
    return (
      eventTypes.find(
        (eventType) =>
          eventType.id === definition.id ||
          eventType.systemLabelKey === definition.messageKey
      )?.id ?? definition.legacyValue
    )
  }

  return eventTypes[0]?.id ?? defaultEventTypeDefinitions[0].legacyValue
}

export function eventCategoryLabel(
  value: string,
  eventTypes: readonly CategoryLike[],
  translate: (key: AppMessageKey) => string
) {
  const category = eventTypes.find((eventType) => eventType.id === value)
  if (category) return categoryLabel(category, translate)

  const definition = defaultEventTypeDefinitions.find(
    (item) =>
      item.id === value ||
      item.legacyValue.toLowerCase() === value.trim().toLowerCase()
  )
  return definition ? translate(definition.messageKey) : value
}
