"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink, FileText, Files, Users } from "lucide-react"

import { DocumentResourceIcon } from "@/components/documents/document-card"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { documentResourceLabel, formatFileSize } from "@/lib/documents"
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

  const resourceHref = document.resource?.url

  return (
    <article className="space-y-6">
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
      </div>

      {document.bannerImageUrl && (
        <div
          className="aspect-[16/5] min-h-40 border bg-muted bg-cover bg-center"
          style={{ backgroundImage: `url("${document.bannerImageUrl}")` }}
        />
      )}

      <div className="max-w-4xl">
        <Badge variant="secondary">
          {documentResourceLabel(document.resource)}
        </Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {document.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{document.description}</p>
        {document.employees.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            {document.employees.map((employee) => (
              <Badge
                key={employee.id ?? employee.displayName}
                variant="outline"
              >
                {employee.displayName}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {document.resource ? (
        <Card className="max-w-4xl shadow-none">
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex size-12 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <DocumentResourceIcon resource={document.resource} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {document.resource.kind === "file"
                  ? document.resource.name
                  : documentResourceLabel(document.resource)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {document.resource.kind === "file"
                  ? `${formatFileSize(document.resource.size)} · Opens in a new tab`
                  : "Shared externally · Opens in a new tab"}
              </p>
            </div>
            <a
              href={resourceHref}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants()}
            >
              {document.resource.kind === "file" ? "Open file" : "Open link"}
              <ExternalLink />
            </a>
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-4xl border-dashed shadow-none">
          <CardContent className="flex items-center gap-3 text-muted-foreground">
            <FileText className="size-5" />
            This legacy document needs a file or shared link before it can be
            opened.
          </CardContent>
        </Card>
      )}

      {document.resource?.kind === "file" &&
        document.resource.contentType.startsWith("image/") && (
          <a
            href={document.resource.url}
            target="_blank"
            rel="noreferrer"
            className="block max-w-4xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <div
              className="aspect-video border bg-muted bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: `url("${document.resource.url}")`,
              }}
              role="img"
              aria-label={document.resource.name}
            />
          </a>
        )}
    </article>
  )
}
