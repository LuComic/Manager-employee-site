import { useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { TranslationValues } from "next-intl"

import { getPathname } from "@/i18n/navigation"
import { languageTags, type Locale } from "@/i18n/routing"

const dotEscape = "․"

export function toMessageKey(message: string) {
  return message.replaceAll(".", dotEscape)
}

export function useAppTranslations() {
  const translations = useTranslations("App")

  return useCallback(
    (message: string, values?: TranslationValues) => {
      const key = toMessageKey(message)
      return translations.has(key) ? translations(key, values) : message
    },
    [translations]
  )
}

export function useLanguageTag() {
  return languageTags[useLocale() as Locale]
}

export function useLocalizedHref() {
  const locale = useLocale() as Locale

  return useCallback(
    (href: string) =>
      href.startsWith("/") && !href.startsWith("//")
        ? getPathname({ locale, href })
        : href,
    [locale]
  )
}
