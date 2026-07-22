import Link from "next/link"
import { ArrowRight, FileText, Presentation, Table2 } from "lucide-react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  documentTypeLabel,
  type DocumentType,
  type WorkspaceDocument,
} from "@/lib/documents"

export function DocumentTypeIcon({ type }: { type: DocumentType }) {
  const Icon =
    type === "table"
      ? Table2
      : type === "presentation"
        ? Presentation
        : FileText
  return <Icon className="size-5" />
}

export function DocumentCard({ document }: { document: WorkspaceDocument }) {
  return (
    <Link
      href={`/documents/${document.id}`}
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card
        size="sm"
        className="h-full shadow-none transition-colors group-hover:bg-muted/40"
      >
        <CardHeader>
          <span className="mb-2 flex size-9 items-center justify-center bg-primary/10 text-primary">
            <DocumentTypeIcon type={document.type} />
          </span>
          <CardTitle className="text-base tracking-normal normal-case">
            {document.title}
          </CardTitle>
          <CardDescription>{document.description}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto justify-between">
          <span className="text-xs text-muted-foreground">
            {documentTypeLabel(document.type)}
          </span>
          <span className="flex size-9 items-center justify-center text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground">
            <ArrowRight className="size-4" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
