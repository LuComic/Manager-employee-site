import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { hasLocale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { HubEntryScreen } from "@/components/operations/hub-access-gate"
import { routing } from "@/i18n/routing"

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/join">): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const t = await getTranslations({ locale, namespace: "App" })

  return {
    title: t("joinAWorkplace"),
    description: t("signInCreateAccountOpenWorkplace"),
  }
}

export default async function JoinPage() {
  const { isAuthenticated, orgId } = await auth()

  return (
    <HubEntryScreen
      initialHubSlug=""
      isSignedIn={isAuthenticated}
      hasActiveOrganization={Boolean(orgId)}
    />
  )
}
