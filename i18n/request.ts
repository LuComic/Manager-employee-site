import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { notFound } from "next/navigation"

import { normalizeMessageKeys } from "@/i18n/messages"
import { routing } from "@/i18n/routing"

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return {
    locale,
    messages: normalizeMessageKeys(
      (await import(`../messages/${locale}.json`)).default
    ),
    timeZone: "Europe/Tallinn",
  }
})
