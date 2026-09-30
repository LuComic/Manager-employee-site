"use client"

import { UserButton } from "@clerk/nextjs"
import { Languages } from "lucide-react"
import { useLocale } from "next-intl"
import { getPathname, usePathname } from "@/i18n/navigation"
import { useAppTranslations } from "@/i18n/use-app-translations"

export function AccountUserButton() {
  const locale = useLocale()
  const pathname = usePathname()
  const t = useAppTranslations()
  const nextLocale = locale === "et" ? "en" : "et"

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action label="manageAccount" />
        <UserButton.Action
          label={t(
            nextLocale === "en" ? "switchToEnglish" : "switchToEstonian"
          )}
          labelIcon={<Languages className="size-4" />}
          onClick={() => {
            // Reload the document so its language and theme bootstrap stay in sync.
            const path = getPathname({ locale: nextLocale, href: pathname })
            window.location.assign(
              `${path}${window.location.search}${window.location.hash}`
            )
          }}
        />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton>
  )
}
