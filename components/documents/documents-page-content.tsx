"use client"

import { Files } from "lucide-react"

import { DocumentCard } from "@/components/documents/document-card"
import { ManageSectionButton } from "@/components/knowledge-base/manage-section-button"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"

export function DocumentsPageContent() {
  const { documents } = useOperations()
  const publishedDocuments = documents.filter((document) => document.published)

  return (
    <div>
      <PageHeading
        title="documents"
        description="filesSharedLinksTeamNeeds"
        action={
          <ManageSectionButton
            section="documents"
            href="/manager/documents"
            label="manageDocuments"
          />
        }
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
            title="noPublishedDocuments"
            description="documentsAppearHereManagerPublishes"
          />
        </div>
      )}
    </div>
  )
}
