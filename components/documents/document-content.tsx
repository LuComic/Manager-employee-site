"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { RichTextContent } from "@/components/rich-text/rich-text-content"
import { Button } from "@/components/ui/button"
import type {
  PresentationDocumentContent,
  TableDocumentContent,
  WorkspaceDocument,
} from "@/lib/documents"
import { cn } from "@/lib/utils"

export function DocumentContent({ document }: { document: WorkspaceDocument }) {
  if (document.type === "text") {
    return (
      <RichTextContent
        content={document.content.body}
        className="mx-auto max-w-3xl"
      />
    )
  }
  if (document.type === "table") {
    return <DocumentTable content={document.content} />
  }
  return <PresentationViewer content={document.content} />
}

export function DocumentTable({ content }: { content: TableDocumentContent }) {
  const showColumnHeaders = content.showColumnHeaders ?? true
  const showRowHeaders = content.showRowHeaders ?? true

  return (
    <div className="overflow-x-auto border">
      <table className="w-full min-w-2xl border-collapse text-left text-sm">
        {showColumnHeaders ? (
          <thead className="bg-muted/60">
            <tr>
              {showRowHeaders ? (
                <th scope="col" className="border-r px-4 py-3 font-semibold">
                  Row
                </th>
              ) : null}
              {content.columns.map((column, index) => (
                <th
                  key={`${column}-${index}`}
                  scope="col"
                  className="border-r px-4 py-3 font-semibold last:border-r-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {content.rows.length ? (
            content.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  showColumnHeaders || rowIndex > 0 ? "border-t" : undefined
                }
              >
                {showRowHeaders ? (
                  <th
                    scope="row"
                    className="border-r bg-muted/60 px-4 py-3 align-top font-semibold whitespace-nowrap"
                  >
                    {content.rowHeaders?.[rowIndex] ?? `Row ${rowIndex + 1}`}
                  </th>
                ) : null}
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border-r px-4 py-3 align-top whitespace-pre-wrap last:border-r-0"
                  >
                    {cell || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className={showColumnHeaders ? "border-t" : undefined}>
              <td
                colSpan={content.columns.length + (showRowHeaders ? 1 : 0)}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No rows have been added.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function PresentationViewer({
  content,
}: {
  content: PresentationDocumentContent
}) {
  const [current, setCurrent] = useState(0)
  const last = Math.max(0, content.slides.length - 1)
  const activeIndex = Math.min(current, last)
  const slide = content.slides[activeIndex]

  if (!slide) return null

  return (
    <div className="space-y-4">
      <div className="aspect-video min-h-72 w-full overflow-auto border bg-background p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">
          Slide {activeIndex + 1} of {content.slides.length}
        </p>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          {slide.title}
        </h2>
        <RichTextContent
          content={slide.body}
          className="mt-4 max-w-3xl sm:text-lg"
        />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {content.slides.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center border text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                index === activeIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              )}
              onClick={() => setCurrent(index)}
              aria-label={`Show slide ${index + 1}: ${item.title}`}
              aria-current={index === activeIndex ? "step" : undefined}
            >
              {index + 1}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrent((value) => Math.max(0, value - 1))}
            disabled={activeIndex === 0}
          >
            <ChevronLeft /> Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCurrent((value) => Math.min(last, value + 1))}
            disabled={activeIndex === last}
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
