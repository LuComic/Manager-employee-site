import "server-only"

import type { Locale } from "@/i18n/config"

export type Messages = Record<string, string>

const dictionaries: Record<Locale, () => Promise<Messages>> = {
  et: () =>
    import("@/messages/et.json").then(
      (dictionary) => dictionary.default as Messages
    ),
  en: () =>
    import("@/messages/en.json").then(
      (dictionary) => dictionary.default as Messages
    ),
}

export function getMessages(locale: Locale) {
  return dictionaries[locale]()
}
