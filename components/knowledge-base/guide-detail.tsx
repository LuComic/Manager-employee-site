import { T } from "@/components/translated-text"

import { Link } from "@/i18n/navigation"
import { ArrowLeft, Clock3 } from "lucide-react"

import { PrintButton } from "@/components/knowledge-base/print-button"
import { RichTextContent } from "@/components/rich-text/rich-text-content"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Category, Guide } from "@/lib/knowledge-base"
import { cn } from "@/lib/utils"

export function GuideDetail({
  guide,
  category,
  preview = false,
}: {
  guide: Guide
  category?: Category
  preview?: boolean
}) {
  const Icon = guide.icon

  return (
    <article className="mx-auto max-w-4xl">
      {!preview && (
        <Link
          href={category ? `/categories/${category.id}` : "/guides"}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-6 tracking-normal normal-case"
          )}
        >
          <ArrowLeft /> <T>Back to</T> {category?.label ?? "guides"}
        </Link>
      )}

      <Card className="gap-0 py-0 shadow-none">
        <div className="border-b p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" /> {guide.duration}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {guide.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {guide.description}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-6">
          <RichTextContent content={guide.content} />
        </CardContent>

        <div className="flex flex-col gap-4 border-t bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{guide.updated}</span>
          {!preview && <PrintButton />}
        </div>
      </Card>
    </article>
  )
}
