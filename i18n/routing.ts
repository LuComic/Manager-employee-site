import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["et", "en"],
  defaultLocale: "et",
  localePrefix: "always",
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
})

export type Locale = (typeof routing.locales)[number]

export const languageTags: Record<Locale, string> = {
  et: "et-EE",
  en: "en-GB",
}
