import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"

import { HubEntryScreen } from "@/components/operations/hub-access-gate"
import { isLocale } from "@/i18n/config"
import { getMessages } from "@/i18n/messages"

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/join">): Promise<Metadata> {
  const { lang } = await params
  if (!isLocale(lang)) return {}
  const messages = await getMessages(lang)

  return {
    title: messages["Join a workplace | Operations hub"],
    description:
      messages[
        "Sign in, create an account, or open an operations hub with a workplace link, ID, or employee code."
      ],
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
