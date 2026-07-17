import { auth } from "@clerk/nextjs/server"

import { ManagerShell } from "@/components/manager/manager-shell"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  await auth.protect()
  return <ManagerShell>{children}</ManagerShell>
}
