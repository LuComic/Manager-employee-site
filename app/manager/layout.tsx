import { ManagerShell } from "@/components/manager/manager-shell"

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ManagerShell>{children}</ManagerShell>
}
