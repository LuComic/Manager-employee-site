import type { TranslationValues } from "next-intl"

import { useAppTranslations } from "@/i18n/use-app-translations"

export function T({
  children,
  values,
}: {
  children: string | number
  values?: TranslationValues
}) {
  const t = useAppTranslations()
  return t(String(children), values)
}
