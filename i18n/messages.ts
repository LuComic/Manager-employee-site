const dotEscape = "․"

export type AppMessages = {
  [key: string]: AppMessages | string
}

export function toMessageKey(message: string) {
  return message.replaceAll(".", dotEscape)
}

export function normalizeMessageKeys<T extends AppMessages>(messages: T): T {
  const normalized: AppMessages = {}

  for (const [key, value] of Object.entries(messages)) {
    const normalizedKey = toMessageKey(key)
    if (Object.hasOwn(normalized, normalizedKey)) {
      throw new Error(
        `Message keys "${key}" and another key both normalize to "${normalizedKey}"`
      )
    }
    normalized[normalizedKey] =
      typeof value === "string" ? value : normalizeMessageKeys(value)
  }

  return normalized as T
}
