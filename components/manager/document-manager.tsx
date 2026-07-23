"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { FilePenLine, Files, Plus, Search, Trash2 } from "lucide-react"

import { DocumentTypeIcon } from "@/components/documents/document-card"
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
import {
  documentTypeLabel,
  type DocumentType,
  type WorkspaceDocument,
} from "@/lib/documents"
import { cn } from "@/lib/utils"

type Status = "All" | "Published" | "Draft"
type TypeFilter = "all" | DocumentType

export function DocumentManager() {
  const {
    documents,
    canCreateContent,
    saveDocument,
    deleteDocument,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [type, setType] = useState<TypeFilter>("all")
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
          (type === "all" || document.type === type)
        )
      }),
    [documents, query, status, type]
  )

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Manage documents"
        description="Create, edit, publish, and remove shared texts, tables, and presentations."
        action={
          canCreateContent ? (
            <Link href="/manager/documents/new" className={buttonVariants()}>
              <Plus /> New document
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
          value={type}
          onValueChange={(value) => setType(value as TypeFilter)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label="Filter documents by type"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="presentation">Presentation</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label="Filter documents by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((document) => (
            <Card key={document.id} size="sm" className="shadow-none">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <DocumentTypeIcon type={document.type} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{document.title}</h3>
                    <Badge
                      variant={document.published ? "secondary" : "outline"}
                    >
                      {document.published ? "Published" : "Draft"}
                    </Badge>
                    <Badge variant="outline">
                      {documentTypeLabel(document.type)}
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
                    {document.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Link
                    href={`/manager/documents/${document.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <FilePenLine /> Edit
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(document)}
                      aria-label={`Delete ${document.title}`}
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
              : "Create a text, table, or presentation to share with the team."
          }
          actionLabel={
            documents.length || !canCreateContent
              ? undefined
              : "Create document"
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
