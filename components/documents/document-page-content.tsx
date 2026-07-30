"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { ArrowLeft, ExternalLink, Files, Users } from "lucide-react"

import { DocumentResourceIcon } from "@/components/documents/document-card"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  documentResourceLabelKey,
  formatFileSize,
  sharedLinkHost,
} from "@/lib/documents"
import { cn } from "@/lib/utils"

export function DocumentPageContent({ documentId }: { documentId: string }) {
  const t = useAppTranslations()
  const { documents } = useOperations()
  const document = documents.find(
    (item) => item.id === documentId && item.published
  )

  if (!document)
    return (
      <EmptyState
        icon={Files}
        title="documentNotAvailable"
        description="documentUnpublishedRemovedBrowseLibraryFind"
        actionLabel="backToDocuments"
        actionHref="/documents"
      />
    )

  const resource = document.resource
  if (!resource) {
    throw new Error("Published document is missing a resource")
  }

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
          <ArrowLeft data-icon="inline-start" /> <T>backToDocuments</T>
        </Link>
      </div>

      {document.bannerImageUrl && (
        <div
          className="aspect-[16/5] min-h-40 border bg-muted bg-cover bg-center"
          style={{ backgroundImage: `url("${document.bannerImageUrl}")` }}
        />
      )}

      <div className="max-w-4xl space-y-4">
        <Badge variant="secondary">
          {t(documentResourceLabelKey(resource))}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          {document.title}
        </h1>
        <p className="text-muted-foreground">{document.description}</p>
        {document.employees.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
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

      <Card className="max-w-4xl shadow-none">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center bg-primary/10 text-primary">
            <DocumentResourceIcon resource={resource} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {resource.kind === "file"
                ? resource.name
                : (sharedLinkHost(resource) ?? t("sharedLink"))}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {resource.kind === "file"
                ? t("fileSizeAndNewTab", {
                    size: formatFileSize(resource.size),
                  })
                : t("sharedExternallyOpensNewTab")}
            </p>
          </div>
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants()}
          >
            <T>{resource.kind === "file" ? "openFile" : "openLink"}</T>
            <ExternalLink data-icon="inline-end" />
          </a>
        </CardContent>
      </Card>

      {resource.kind === "file" &&
        resource.contentType.startsWith("image/") && (
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="block max-w-4xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <div
              className="aspect-video border bg-muted bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: `url("${resource.url}")`,
              }}
              role="img"
              aria-label={resource.name}
            />
          </a>
        )}
    </article>
  )
}
