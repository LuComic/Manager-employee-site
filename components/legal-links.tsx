"use client"

import { useLocale } from "next-intl"

export function LegalLinks() {
  const locale = useLocale()
  return (
    <nav
      aria-label={locale === "et" ? "Õiguslik teave" : "Legal"}
      className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-5 text-sm text-muted-foreground"
    >
      <a
        className="underline underline-offset-4 hover:text-foreground"
        href={`https://workhal.com/${locale}/privacy`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {locale === "et" ? "Privaatsuspoliitika" : "Privacy policy"}
      </a>
      <a
        className="underline underline-offset-4 hover:text-foreground"
        href={`https://workhal.com/${locale}/tos`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {locale === "et" ? "Kasutustingimused" : "Terms of service"}
      </a>
    </nav>
  )
}
