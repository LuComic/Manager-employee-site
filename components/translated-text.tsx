import type { TranslationValues } from "next-intl"

import { useAppTranslations } from "@/i18n/use-app-translations"
import type { AppMessageKey } from "@/i18n/messages"

export function T({
  children,
  values,
}: {
  // JSX text children are widened to `string`; the catalog-key test enforces
  // that every literal and expression passed to <T> resolves to an App key.
  children: string
  values?: TranslationValues
}) {
  const t = useAppTranslations()
  return t(children as AppMessageKey, values)
}
