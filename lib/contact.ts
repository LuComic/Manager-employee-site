export const DEFAULT_CONTACT_NAMES = ["shift lead", "vahetusvanem"] as const

export function getCustomContactName(contactName?: string) {
  const normalized = contactName?.trim()

  return normalized &&
    DEFAULT_CONTACT_NAMES.includes(
      normalized.toLocaleLowerCase(
        "en-US"
      ) as (typeof DEFAULT_CONTACT_NAMES)[number]
    )
    ? undefined
    : normalized || undefined
}
