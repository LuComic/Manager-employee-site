"use client"

import { Files } from "lucide-react"

import { DocumentCard } from "@/components/documents/document-card"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"

export function DocumentsPageContent() {
  const { documents } = useOperations()
  const publishedDocuments = documents.filter((document) => document.published)

  return (
    <div>
      <PageHeading
        title="Documents"
        description="Shared texts, tables, and presentations."
      />
      {publishedDocuments.length ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {publishedDocuments.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
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
