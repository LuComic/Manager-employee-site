"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  FileText,
  Plus,
  Trash2,
} from "lucide-react"

import { DocumentContent } from "@/components/documents/document-content"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  createDefaultDocumentContent,
  documentTypeLabel,
  type DocumentType,
  type PresentationDocumentContent,
  type TableDocumentContent,
  type WorkspaceDocument,
} from "@/lib/documents"
import { slugify } from "@/lib/operations"
import { isRichTextEmpty } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

function cloneDocument(document: WorkspaceDocument) {
  return JSON.parse(JSON.stringify(document)) as WorkspaceDocument
}

function newDocument(): WorkspaceDocument {
  return {
    id: "",
    title: "",
    description: "",
    type: "text",
    content: createDefaultDocumentContent("text"),
    published: false,
    updatedAt: Date.now(),
  }
}

export function DocumentEditor({ documentId }: { documentId?: string }) {
  const { documents, saveDocument, showFeedback } = useOperations()
  const existing = documentId
    ? documents.find((document) => document.id === documentId)
    : undefined
  const [draft, setDraft] = useState<WorkspaceDocument | null>(() =>
    documentId ? (existing ? cloneDocument(existing) : null) : newDocument()
  )
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const { leaveWithoutPrompt, requestLeave } = useUnsavedChanges({
    dirty,
    itemName: "document",
    toastId: "discard-document-changes",
    onDiscard: () => setDirty(false),
  })

  function changeBase(
    patch: Partial<
      Pick<WorkspaceDocument, "title" | "description" | "published">
    >
  ) {
    if (!draft) return
    setDraft({ ...draft, ...patch } as WorkspaceDocument)
    setDirty(true)
    setError("")
  }

  function changeType(type: DocumentType) {
    if (!draft || type === draft.type) return
    if (dirty) {
      toast.warning("Replace the current document content?", {
        id: "change-document-type",
        description: `Changing to ${documentTypeLabel(type).toLocaleLowerCase()} will reset the current content.`,
        duration: Infinity,
        cancel: {
          label: "Keep current",
          onClick: () => undefined,
        },
        action: {
          label: "Change type",
          onClick: () => applyType(type),
        },
      })
      return
    }
    applyType(type)
  }

  function applyType(type: DocumentType) {
    setDraft((current) => {
      if (!current || type === current.type) return current

      const base = {
        id: current.id,
        title: current.title,
        description: current.description,
        published: current.published,
        updatedAt: current.updatedAt,
      }

      if (type === "table")
        return {
          ...base,
          type,
          content: createDefaultDocumentContent("table"),
        }
      if (type === "presentation")
        return {
          ...base,
          type,
          content: createDefaultDocumentContent("presentation"),
        }
      return {
        ...base,
        type,
        content: createDefaultDocumentContent("text"),
      }
    })
    setDirty(true)
    setError("")
    toast.dismiss("change-document-type")
  }

  function leave() {
    requestLeave("/manager/documents")
  }

  async function submit() {
    if (!draft) return
    if (!draft.title.trim() || !draft.description.trim())
      return setError("Add a title and description.")
    if (draft.type === "text" && isRichTextEmpty(draft.content.body))
      return setError("Add text to the document.")
    if (
      draft.type === "presentation" &&
      draft.content.slides.some(
        (slide) => !slide.title.trim() || isRichTextEmpty(slide.body)
      )
    )
      return setError("Add a title and content to every slide.")

    let id = draft.id
    if (!id) {
      const base = slugify(draft.title) || "document"
      id = base
      let suffix = 2
      while (documents.some((document) => document.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }

    setSaving(true)
    try {
      await saveDocument({
        ...draft,
        id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        updatedAt: Date.now(),
      } as WorkspaceDocument)
      setDirty(false)
      showFeedback(draft.id ? "Document saved." : "Document created.")
      leaveWithoutPrompt("/manager/documents")
    } finally {
      setSaving(false)
    }
  }

  if (!draft)
    return (
      <EmptyState
        icon={FileText}
        title="Document not found"
        description="This document may have been removed from the current hub."
        actionLabel="Back to documents"
        actionHref="/manager/documents"
      />
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={leave}>
            <ArrowLeft /> Back to documents
          </Button>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {draft.id ? "Edit document" : "Create document"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Build a simple text, table, or presentation and preview it before
            publishing.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "edit" ? "secondary" : "outline"}
            onClick={() => setMode("edit")}
          >
            <FileText /> Edit
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "secondary" : "outline"}
            onClick={() => setMode("preview")}
          >
            <Eye /> Preview
          </Button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="space-y-8">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">
              {documentTypeLabel(draft.type)}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              {draft.title || "Untitled document"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {draft.description || "Add a short document description."}
            </p>
          </div>
          {draft.type === "presentation" ? (
            <DocumentContent document={draft} />
          ) : (
            <div className="border bg-background p-6 sm:p-8">
              <DocumentContent document={draft} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <Card className="shadow-none">
              <CardContent className="space-y-4">
                <Field label="Title" id="document-title">
                  <Input
                    id="document-title"
                    value={draft.title}
                    onChange={(event) =>
                      changeBase({ title: event.target.value })
                    }
                    className="border border-input px-3 text-base"
                  />
                </Field>
                <Field label="Description" id="document-description">
                  <Textarea
                    id="document-description"
                    value={draft.description}
                    onChange={(event) =>
                      changeBase({ description: event.target.value })
                    }
                    className="min-h-24 border border-input px-3"
                  />
                </Field>
              </CardContent>
            </Card>
            <DocumentContentEditor
              document={draft}
              onChange={(next) => {
                setDraft(next)
                setDirty(true)
                setError("")
              }}
            />
          </div>

          <Card className="h-fit shadow-none">
            <CardContent className="space-y-4">
              <Field label="Document type" id="document-type">
                <Select
                  value={draft.type}
                  onValueChange={(value) => changeType(value as DocumentType)}
                >
                  <SelectTrigger
                    id="document-type"
                    className="w-full border border-input bg-background px-3"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <p className="text-xs text-muted-foreground">
                Changing the type resets the document content.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) =>
                    changeBase({ published: event.target.checked })
                  }
                />
                Publish now
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {dirty ? "Unsaved changes" : "No unsaved changes"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={leave}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Save document"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DocumentContentEditor({
  document,
  onChange,
}: {
  document: WorkspaceDocument
  onChange: (document: WorkspaceDocument) => void
}) {
  if (document.type === "text") {
    return (
      <div>
        <Label className="mb-2 block">Document text</Label>
        <RichTextEditor
          value={document.content.body}
          onChange={(body) =>
            onChange({ ...document, content: { kind: "text", body } })
          }
          ariaLabel="Document text"
        />
      </div>
    )
  }
  if (document.type === "table") {
    return (
      <TableEditor
        content={document.content}
        onChange={(content) => onChange({ ...document, content })}
      />
    )
  }
  return (
    <PresentationEditor
      content={document.content}
      onChange={(content) => onChange({ ...document, content })}
    />
  )
}

function TableEditor({
  content,
  onChange,
}: {
  content: TableDocumentContent
  onChange: (content: TableDocumentContent) => void
}) {
  const showColumnHeaders = content.showColumnHeaders ?? true
  const showRowHeaders = content.showRowHeaders ?? true
  const rowHeaders = content.rows.map(
    (_, index) => content.rowHeaders?.[index] ?? `Row ${index + 1}`
  )

  function updateColumn(index: number, value: string) {
    const columns = [...content.columns]
    columns[index] = value
    onChange({ ...content, columns })
  }

  function addColumn() {
    if (content.columns.length >= 12) return
    onChange({
      ...content,
      columns: [...content.columns, `Column ${content.columns.length + 1}`],
      rows: content.rows.map((row) => [...row, ""]),
    })
  }

  function removeColumn(index: number) {
    if (content.columns.length === 1) return
    onChange({
      ...content,
      columns: content.columns.filter(
        (_, columnIndex) => columnIndex !== index
      ),
      rows: content.rows.map((row) =>
        row.filter((_, columnIndex) => columnIndex !== index)
      ),
    })
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    const rows = content.rows.map((row) => [...row])
    rows[rowIndex][columnIndex] = value
    onChange({ ...content, rows })
  }

  function updateRowHeader(index: number, value: string) {
    const nextRowHeaders = [...rowHeaders]
    nextRowHeaders[index] = value
    onChange({ ...content, rowHeaders: nextRowHeaders })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Label>Table content</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to 12 columns and 100 rows.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addColumn}
            disabled={content.columns.length >= 12}
          >
            <Plus /> Add column
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...content,
                rowHeaders: [...rowHeaders, `Row ${content.rows.length + 1}`],
                rows: [...content.rows, content.columns.map(() => "")],
              })
            }
            disabled={content.rows.length >= 100}
          >
            <Plus /> Add row
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 border bg-muted/20 px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showColumnHeaders}
            onChange={(event) =>
              onChange({
                ...content,
                showColumnHeaders: event.target.checked,
              })
            }
          />
          Show column headers
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showRowHeaders}
            onChange={(event) =>
              onChange({
                ...content,
                showRowHeaders: event.target.checked,
              })
            }
          />
          Show row headers
        </label>
      </div>
      <div className="overflow-x-auto border bg-background">
        <table className="w-full min-w-2xl border-collapse text-sm">
          <thead className={showColumnHeaders ? "bg-muted/60" : "bg-muted/20"}>
            <tr>
              <th
                scope="col"
                className={cn(
                  "min-w-44 border-r px-4 py-3 text-left font-semibold",
                  !showRowHeaders && "text-muted-foreground"
                )}
              >
                {showRowHeaders ? "Row titles" : "Row titles hidden"}
              </th>
              {content.columns.map((column, columnIndex) => (
                <th
                  key={columnIndex}
                  scope="col"
                  className="min-w-44 border-r p-2 last:border-r-0"
                >
                  <div className="flex gap-2">
                    <Input
                      value={column}
                      onChange={(event) =>
                        updateColumn(columnIndex, event.target.value)
                      }
                      aria-label={`Column ${columnIndex + 1} name`}
                      className={cn(
                        "border border-input bg-background px-3",
                        !showColumnHeaders && "text-muted-foreground"
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeColumn(columnIndex)}
                      disabled={content.columns.length === 1}
                      aria-label={`Remove column ${columnIndex + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </th>
              ))}
              <th className="w-12" aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t">
                <th scope="row" className="border-r bg-muted/60 p-2 align-top">
                  <Input
                    value={rowHeaders[rowIndex]}
                    onChange={(event) =>
                      updateRowHeader(rowIndex, event.target.value)
                    }
                    aria-label={`Row ${rowIndex + 1} title`}
                    className={cn(
                      "border border-input bg-background px-3 font-medium",
                      !showRowHeaders && "text-muted-foreground"
                    )}
                  />
                </th>
                {row.map((cell, columnIndex) => (
                  <td key={columnIndex} className="border-r p-2">
                    <Textarea
                      value={cell}
                      onChange={(event) =>
                        updateCell(rowIndex, columnIndex, event.target.value)
                      }
                      aria-label={`Row ${rowIndex + 1}, ${content.columns[columnIndex]}`}
                      className="min-h-16 resize-y border border-input px-3 py-2"
                    />
                  </td>
                ))}
                <td className="p-2 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      onChange({
                        ...content,
                        rowHeaders: rowHeaders.filter(
                          (_, index) => index !== rowIndex
                        ),
                        rows: content.rows.filter(
                          (_, index) => index !== rowIndex
                        ),
                      })
                    }
                    aria-label={`Remove row ${rowIndex + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PresentationEditor({
  content,
  onChange,
}: {
  content: PresentationDocumentContent
  onChange: (content: PresentationDocumentContent) => void
}) {
  const [activeId, setActiveId] = useState(content.slides[0]?.id ?? "")
  const activeIndex = Math.max(
    0,
    content.slides.findIndex((slide) => slide.id === activeId)
  )
  const activeSlide = content.slides[activeIndex]

  function addSlide() {
    if (content.slides.length >= 30) return
    let number = content.slides.length + 1
    let id = `slide-${number}`
    while (content.slides.some((slide) => slide.id === id)) {
      number += 1
      id = `slide-${number}`
    }
    const slide = {
      id,
      title: `Slide ${content.slides.length + 1}`,
      body: createDefaultDocumentContent("text").body,
    }
    onChange({ ...content, slides: [...content.slides, slide] })
    setActiveId(id)
  }

  function updateSlide(
    patch: Partial<PresentationDocumentContent["slides"][number]>
  ) {
    onChange({
      ...content,
      slides: content.slides.map((slide, index) =>
        index === activeIndex ? { ...slide, ...patch } : slide
      ),
    })
  }

  function moveSlide(direction: -1 | 1) {
    const target = activeIndex + direction
    if (target < 0 || target >= content.slides.length) return
    const slides = [...content.slides]
    const current = slides[activeIndex]
    slides[activeIndex] = slides[target]
    slides[target] = current
    onChange({ ...content, slides })
  }

  function removeSlide() {
    if (content.slides.length === 1) return
    const slides = content.slides.filter((_, index) => index !== activeIndex)
    setActiveId(slides[Math.min(activeIndex, slides.length - 1)].id)
    onChange({ ...content, slides })
  }

  if (!activeSlide) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Label>Presentation slides</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Add up to 30 slides, then arrange them in order.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSlide}
          disabled={content.slides.length >= 30}
        >
          <Plus /> Add slide
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="space-y-2 border bg-muted/20 p-2">
          {content.slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveId(slide.id)}
              className={cn(
                "w-full border bg-background p-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                slide.id === activeSlide.id && "border-primary bg-primary/5"
              )}
            >
              <span className="text-xs text-muted-foreground">
                Slide {index + 1}
              </span>
              <span className="mt-1 block truncate font-medium">
                {slide.title}
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-4 border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Slide {activeIndex + 1}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => moveSlide(-1)}
                disabled={activeIndex === 0}
                aria-label="Move slide up"
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => moveSlide(1)}
                disabled={activeIndex === content.slides.length - 1}
                aria-label="Move slide down"
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                onClick={removeSlide}
                disabled={content.slides.length === 1}
                aria-label="Remove slide"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          <Field label="Slide title" id="slide-title">
            <Input
              id="slide-title"
              value={activeSlide.title}
              onChange={(event) => updateSlide({ title: event.target.value })}
              className="border border-input px-3"
            />
          </Field>
          <div>
            <Label className="mb-2 block">Slide content</Label>
            <RichTextEditor
              key={activeSlide.id}
              value={activeSlide.body}
              onChange={(body) => updateSlide({ body })}
              ariaLabel={`Slide ${activeIndex + 1} content`}
              className="[&_.tiptap]:min-h-64"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
