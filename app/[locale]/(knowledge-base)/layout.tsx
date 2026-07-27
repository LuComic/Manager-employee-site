import { SiteShell } from "@/components/knowledge-base/site-shell"

export default function KnowledgeBaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <SiteShell>{children}</SiteShell>
}
