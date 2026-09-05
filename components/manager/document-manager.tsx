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
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { WorkersCanEditToggle } from "@/components/manager/workers-can-edit-toggle"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
            <ManagerListItem
              key={document.id}
              icon={<DocumentResourceIcon resource={document.resource} />}
              iconClassName="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              cardClassName="border-l-2 border-l-emerald-400 dark:border-l-emerald-500"
              title={document.title}
              summaryHref={
                document.published
                  ? `/documents/${document.id}`
                  : `/manager/documents/${document.id}/edit`
              }
              metadata={[
                <Badge
                  key="status"
                  variant={document.published ? "secondary" : "outline"}
                >
                  <T>{document.published ? "published" : "draft"}</T>
                </Badge>,
                <Badge key="resource" variant="outline">
                  {t(documentResourceLabelKey(document.resource))}
                </Badge>,
              ]}
              description={document.description}
              actionsClassName="grid w-full grid-flow-col auto-cols-fr sm:flex sm:w-auto sm:flex-wrap"
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-full sm:min-h-9 sm:w-auto"
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
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "min-h-11 w-full sm:min-h-9 sm:w-auto"
                    )}
                  >
                    <FilePenLine data-icon="inline-start" /> <T>edit</T>
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      className="w-full sm:size-9"
                      onClick={() => setDeleteTarget(document)}
                      aria-label={t("deleteName", {
                        name: document.title,
                      })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          area="documents"
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
