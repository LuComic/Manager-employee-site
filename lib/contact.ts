export const DEFAULT_CONTACT_NAME = "shift lead"

export function getCustomContactName(contactName?: string) {
  const normalized = contactName?.trim()

  return normalized?.toLocaleLowerCase("en-US") === DEFAULT_CONTACT_NAME
    ? undefined
    : normalized || undefined
}
