import { DocumentPageContent } from "@/components/documents/document-page-content"

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ document: string }>
}) {
  const { document } = await params
  return <DocumentPageContent documentId={document} />
}
