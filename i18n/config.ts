export const locales = ["et", "en"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "et"
export const localeCookieName = "NEXT_LOCALE"
export const languageTags: Record<Locale, string> = {
  et: "et-EE",
  en: "en-GB",
}

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segment = pathname.split("/")[1]
  return isLocale(segment) ? segment : null
}

export function stripLocaleFromPathname(pathname: string) {
  const locale = getLocaleFromPathname(pathname)
  if (!locale) return pathname

  const stripped = pathname.slice(locale.length + 1)
  return stripped || "/"
}

export function localizeHref(href: string, locale: Locale) {
  if (
    !href.startsWith("/") ||
    href.startsWith("//") ||
    href.startsWith("/api/")
  ) {
    return href
  }

  const hashIndex = href.indexOf("#")
  const queryIndex = href.indexOf("?")
  const suffixIndex =
    hashIndex === -1
      ? queryIndex
      : queryIndex === -1
        ? hashIndex
        : Math.min(hashIndex, queryIndex)
  const pathname = suffixIndex === -1 ? href : href.slice(0, suffixIndex)
  const suffix = suffixIndex === -1 ? "" : href.slice(suffixIndex)
  const unlocalizedPathname = stripLocaleFromPathname(pathname)

  return `/${locale}${unlocalizedPathname === "/" ? "" : unlocalizedPathname}${suffix}`
}
