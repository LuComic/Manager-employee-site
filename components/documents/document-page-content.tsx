"use client"

import Link from "next/link"
import { ArrowLeft, Files } from "lucide-react"

import { DocumentContent } from "@/components/documents/document-content"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { documentTypeLabel } from "@/lib/documents"
import { cn } from "@/lib/utils"

export function DocumentPageContent({ documentId }: { documentId: string }) {
  const { documents } = useOperations()
  const document = documents.find(
    (item) => item.id === documentId && item.published
  )

  if (!document)
    return (
      <EmptyState
        icon={Files}
        title="Document not available"
        description="This document may be unpublished or removed. Browse the library to find another."
        actionLabel="Back to documents"
        actionHref="/documents"
      />
    )

  return (
    <article className="space-y-8">
      <div>
        <Link
          href="/documents"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-3"
          )}
        >
          <ArrowLeft /> Back to documents
        </Link>
        <div className="mt-6 max-w-4xl">
          <Badge variant="secondary">{documentTypeLabel(document.type)}</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {document.title}
          </h1>
          <p className="mt-3 text-muted-foreground">{document.description}</p>
        </div>
      </div>
      {document.type === "presentation" ? (
        <DocumentContent document={document} />
      ) : (
        <div className="border bg-background p-6 sm:p-8">
          <DocumentContent document={document} />
        </div>
      )}
    </article>
  )
}
