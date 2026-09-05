"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { ArrowLeft, ExternalLink, Files, Users } from "lucide-react"

import { DocumentResourceIcon } from "@/components/documents/document-card"
import { EmptyState } from "@/components/operations/empty-state"
import { RelatedInformation } from "@/components/operations/related-information"
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
  const { documents, guides } = useOperations()
  const document = documents.find(
    (item) => item.id === documentId && item.published
  )

  if (!document)
    return (
      <EmptyState
        area="documents"
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
  const relatedGuides = guides.filter(
    (guide) =>
      guide.published && (document.relatedGuideIds ?? []).includes(guide.id)
  )

  return (
    <article className="max-w-full min-w-0 space-y-6 overflow-x-clip">
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
          className="h-40 w-full max-w-full overflow-hidden border bg-muted bg-cover bg-center sm:aspect-[16/5] sm:h-auto"
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

      <Card className="max-w-4xl border-l-2 border-l-emerald-400 shadow-none dark:border-l-emerald-500">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex size-12 shrink-0 items-center justify-center bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
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
            className="block max-w-4xl min-w-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <div
              className="aspect-video w-full max-w-full overflow-hidden border bg-muted bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: `url("${resource.url}")`,
              }}
              role="img"
              aria-label={resource.name}
            />
          </a>
        )}

      <RelatedInformation guides={relatedGuides} className="max-w-4xl" />
    </article>
  )
}
