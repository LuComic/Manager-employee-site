import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"

import { HubEntryScreen } from "@/components/operations/hub-access-gate"

export const metadata: Metadata = {
  title: "Join a workplace | Operations hub",
  description:
    "Sign in, create an account, or open an operations hub with a workplace link, ID, or employee code.",
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
