import { useCallback } from "react"
import { useLocale, useTranslations } from "next-intl"
import type { TranslationValues } from "next-intl"

import type { AppMessageKey } from "@/i18n/messages"
import { getPathname } from "@/i18n/navigation"
import { languageTags, type Locale } from "@/i18n/routing"
import { extractAppErrorKey } from "@/lib/app-error"

export function useAppTranslations() {
  const translations = useTranslations("App")

  return useCallback(
    (key: AppMessageKey, values?: TranslationValues) =>
      translations(key, values),
    [translations]
  )
}

export function useAppErrorTranslation() {
  const translations = useTranslations("App")

  return useCallback(
    (error: unknown) => {
      const key = extractAppErrorKey(error)
      return key && translations.has(key)
        ? translations(key)
        : translations("somethingWentWrong")
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
