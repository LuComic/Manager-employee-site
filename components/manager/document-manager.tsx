"use client"

import { T, useI18n } from "@/components/providers/i18n-provider"

import { useMemo, useState } from "react"
import { LocalizedLink as Link } from "@/components/localized-link"
import { FilePenLine, Files, Plus, Search, Trash2 } from "lucide-react"

import { DocumentResourceIcon } from "@/components/documents/document-card"
import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
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
import { documentResourceLabel, type WorkspaceDocument } from "@/lib/documents"
import { cn } from "@/lib/utils"

type Status = "All" | "Published" | "Draft"
type ResourceFilter = "all" | "file" | "link"

export function DocumentManager() {
  const { t } = useI18n()
  const {
    documents,
    canCreateContent,
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
        title="Manage documents"
        description="Share files and external links with the right employees."
        action={
          canCreateContent ? (
            <Link href="/manager/documents/new" className={buttonVariants()}>
              <Plus /> <T>Share document</T>
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-4 border bg-background p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-3 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={resourceType}
          onValueChange={(value) => setResourceType(value as ResourceFilter)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("Filter documents by resource type")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <T>All resources</T>
            </SelectItem>
            <SelectItem value="file">
              <T>Uploaded files</T>
            </SelectItem>
            <SelectItem value="link">
              <T>Shared links</T>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("Filter documents by status")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>All</T>
            </SelectItem>
            <SelectItem value="Published">
              <T>Published</T>
            </SelectItem>
            <SelectItem value="Draft">
              <T>Draft</T>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
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
                      <T>{document.published ? "Published" : "Draft"}</T>
                    </Badge>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant="outline">
                      {documentResourceLabel(document.resource)}
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
                              ? "Document unpublished."
                              : "Document published."
                          )
                        } catch {
                          // The shared operation runner already shows the error.
                        }
                      })()
                    }}
                  >
                    <T>{document.published ? "Unpublish" : "Publish"}</T>
                  </Button>
                  <Link
                    href={`/manager/documents/${document.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <FilePenLine /> <T>Edit</T>
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(document)}
                      aria-label={t("Delete {name}", {
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
          title={
            documents.length ? "No matching documents" : "No documents yet"
          }
          description={
            documents.length
              ? "Clear the search or choose another filter."
              : "Upload a file or share a link with the team."
          }
          actionLabel={
            documents.length || !canCreateContent ? undefined : "Share document"
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
              showFeedback("Document deleted.")
            } catch {
              // The shared operation runner already shows the error.
            }
          })()
        }}
      />
    </div>
  )
}
