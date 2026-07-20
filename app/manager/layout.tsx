import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { ManagerShell } from "@/components/manager/manager-shell"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session.isAuthenticated) return session.redirectToSignIn()
  if (session.orgId && !session.has({ role: "org:admin" })) redirect("/")
  return <ManagerShell>{children}</ManagerShell>
}
