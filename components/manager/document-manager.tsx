"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { FilePenLine, Files, Plus, Search, Trash2 } from "lucide-react"

import { DocumentResourceIcon } from "@/components/documents/document-card"
import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerFilterPanel } from "@/components/manager/manager-filter-panel"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { WorkersCanEditToggle } from "@/components/manager/workers-can-edit-toggle"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  documentResourceLabelKey,
  type WorkspaceDocument,
} from "@/lib/documents"
import { cn } from "@/lib/utils"

type Status = "All" | "Published" | "Draft"
type ResourceFilter = "all" | "file" | "link"

export function DocumentManager() {
  const t = useAppTranslations()
  const {
    documents,
    canCreateContent,
    canCreateInSection,
    saveDocument,
    deleteDocument,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [resourceType, setResourceType] = useState<ResourceFilter>("all")
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceDocument | null>(
    null
  )
  const canCreateDocuments = canCreateInSection("documents")
  const visible = useMemo(
    () =>
      documents.filter((document) => {
        const matchesQuery = `${document.title} ${document.description}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())
        const matchesStatus =
          status === "All" ||
          (status === "Published" ? document.published : !document.published)
        return (
          matchesQuery &&
          matchesStatus &&
          (resourceType === "all" || document.resource.kind === resourceType)
        )
      }),
    [documents, query, status, resourceType]
  )

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="manageDocuments"
        description="shareFilesExternalLinksRightEmployees"
        action={
          canCreateContent || canCreateDocuments ? (
            <div className="flex flex-wrap gap-2">
              <WorkersCanEditToggle section="documents" />
              {canCreateDocuments && (
                <Link
                  href="/manager/documents/new"
                  className={buttonVariants()}
                >
                  <Plus data-icon="inline-start" /> <T>shareDocument</T>
                </Link>
              )}
            </div>
          ) : undefined
        }
      />
      <ManagerFilterPanel className="grid sm:grid-cols-3">
        <div className="relative sm:col-span-3 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchDocumentsPlaceholder")}
            aria-label={t("searchDocuments")}
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={resourceType}
          onValueChange={(value) => setResourceType(value as ResourceFilter)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterDocumentsByResourceType")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <T>allResources</T>
            </SelectItem>
            <SelectItem value="file">
              <T>uploadedFiles</T>
            </SelectItem>
            <SelectItem value="link">
              <T>sharedLinks</T>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterDocumentsByStatus")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>all</T>
            </SelectItem>
            <SelectItem value="Published">
              <T>published</T>
            </SelectItem>
            <SelectItem value="Draft">
              <T>draft</T>
            </SelectItem>
          </SelectContent>
        </Select>
      </ManagerFilterPanel>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((document) => (
            <Card key={document.id} size="sm" className="shadow-none">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <DocumentResourceIcon resource={document.resource} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{document.title}</h3>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge
                      variant={document.published ? "secondary" : "outline"}
                    >
                      <T>{document.published ? "published" : "draft"}</T>
                    </Badge>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant="outline">
                      {t(documentResourceLabelKey(document.resource))}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {document.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        try {
                          await saveDocument({
                            ...document,
                            published: !document.published,
                            updatedAt: Date.now(),
                          })
                          showFeedback(
                            document.published
                              ? "documentUnpublished"
                              : "documentPublished"
                          )
                        } catch {
                          // The shared operation runner already shows the error.
                        }
                      })()
                    }}
                  >
                    <T>{document.published ? "unpublish" : "publish"}</T>
                  </Button>
                  <Link
                    href={`/manager/documents/${document.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <FilePenLine data-icon="inline-start" /> <T>edit</T>
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(document)}
                      aria-label={t("deleteName", {
                        name: document.title,
                      })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Files}
          title={documents.length ? "noMatchingDocuments" : "noDocumentsYet"}
          description={
            documents.length
              ? "clearSearchChooseFilter"
              : "uploadFileOrShareLinkWithTeam"
          }
          actionLabel={
            documents.length || !canCreateContent ? undefined : "shareDocument"
          }
          actionHref={
            documents.length || !canCreateContent
              ? undefined
              : "/manager/documents/new"
          }
        />
      )}
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? "document"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (!deleteTarget) return
          void (async () => {
            try {
              await deleteDocument(deleteTarget.id)
              showFeedback("documentDeleted")
            } catch {
              // The shared operation runner already shows the error.
            }
          })()
        }}
      />
    </div>
  )
}
