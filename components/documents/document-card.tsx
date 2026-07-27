import { Link } from "@/i18n/navigation"
import {
  ArrowRight,
  File,
  FileSpreadsheet,
  Image as ImageIcon,
  Link2,
  Presentation,
} from "lucide-react"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAppTranslations } from "@/i18n/use-app-translations"
import {
  documentResourceLabel,
  type DocumentResource,
  type WorkspaceDocument,
} from "@/lib/documents"

export function DocumentResourceIcon({
  resource,
}: {
  resource?: DocumentResource
}) {
  if (!resource) return <File className="size-5" />
  if (resource.kind === "link") return <Link2 className="size-5" />
  if (resource.contentType.startsWith("image/"))
    return <ImageIcon className="size-5" />
  if (
    resource.contentType.includes("spreadsheet") ||
    resource.contentType.includes("excel") ||
    resource.contentType === "text/csv"
  )
    return <FileSpreadsheet className="size-5" />
  if (
    resource.contentType.includes("presentation") ||
    resource.contentType.includes("powerpoint")
  )
    return <Presentation className="size-5" />
  return <File className="size-5" />
}

export function DocumentCard({ document }: { document: WorkspaceDocument }) {
  const t = useAppTranslations()

  return (
    <Link
      href={`/documents/${document.id}`}
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card
        size="sm"
        className="h-full overflow-hidden py-0 shadow-none transition-colors group-hover:bg-muted/40"
      >
        {document.bannerImageUrl && (
          <div
            className="aspect-16/6 border-b bg-muted bg-cover bg-center"
            style={{
              backgroundImage: `url("${document.bannerImageUrl}")`,
            }}
          />
        )}
        <CardHeader className="pt-4">
          <span className="mb-2 flex size-9 items-center justify-center bg-primary/10 text-primary">
            <DocumentResourceIcon resource={document.resource} />
          </span>
          <CardTitle className="text-base tracking-normal normal-case">
            {document.title}
          </CardTitle>
          <CardDescription>{document.description}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto justify-between pb-4">
          <span className="text-xs text-muted-foreground">
            {t(documentResourceLabel(document.resource))}
            {document.employees.length
              ? t(
                  document.employees.length === 1
                    ? "countEmployee"
                    : "countEmployees",
                  { count: document.employees.length }
                )
              : ""}
          </span>
          <span className="flex size-9 items-center justify-center text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground">
            <ArrowRight className="size-4" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
