import { auth } from "@clerk/nextjs/server"

import { ManagerShell } from "@/components/manager/manager-shell"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session.isAuthenticated) return session.redirectToSignIn()
  return <ManagerShell>{children}</ManagerShell>
}
