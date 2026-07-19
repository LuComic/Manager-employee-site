"use client"

import { Files } from "lucide-react"

import { DocumentCard } from "@/components/documents/document-card"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"

export function DocumentsPageContent() {
  const { documents } = useOperations()
  const publishedDocuments = documents.filter((document) => document.published)

  return (
    <div>
      <div className="flex max-w-3xl items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center bg-primary/10 text-primary">
          <Files className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Documents
          </h1>
          <p className="mt-4 text-muted-foreground">
            Shared texts, tables, and presentations.
          </p>
        </div>
      </div>
      {publishedDocuments.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {publishedDocuments.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={Files}
            title="No published documents"
            description="Documents will appear here when a manager publishes them."
          />
        </div>
      )}
    </div>
  )
}
