import { DocumentEditor } from "@/components/manager/document-editor"

export default async function Page({
  params,
}: {
  params: Promise<{ document: string }>
}) {
  const { document } = await params
  return <DocumentEditor documentId={document} />
}
