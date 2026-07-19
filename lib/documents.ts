import { paragraphDocument, type RichTextDocument } from "@/lib/rich-text"

export const documentTypes = ["text", "table", "presentation"] as const

export type DocumentType = (typeof documentTypes)[number]

type DocumentBase = {
  id: string
  title: string
  description: string
  published: boolean
  updatedAt: number
}

export type TextDocumentContent = {
  kind: "text"
  body: RichTextDocument
}

export type TableDocumentContent = {
  kind: "table"
  columns: string[]
  showColumnHeaders?: boolean
  showRowHeaders?: boolean
  rowHeaders?: string[]
  rows: string[][]
}

export type PresentationSlide = {
  id: string
  title: string
  body: RichTextDocument
}

export type PresentationDocumentContent = {
  kind: "presentation"
  slides: PresentationSlide[]
}

export type WorkspaceDocument =
  | (DocumentBase & { type: "text"; content: TextDocumentContent })
  | (DocumentBase & { type: "table"; content: TableDocumentContent })
  | (DocumentBase & {
      type: "presentation"
      content: PresentationDocumentContent
    })

export function documentTypeLabel(type: DocumentType) {
  if (type === "text") return "Text"
  if (type === "table") return "Table"
  return "Presentation"
}

export function createDefaultDocumentContent(type: "text"): TextDocumentContent
export function createDefaultDocumentContent(
  type: "table"
): TableDocumentContent
export function createDefaultDocumentContent(
  type: "presentation"
): PresentationDocumentContent
export function createDefaultDocumentContent(
  type: DocumentType
): TextDocumentContent | TableDocumentContent | PresentationDocumentContent {
  if (type === "table") {
    return {
      kind: "table" as const,
      columns: ["Column 1", "Column 2", "Column 3"],
      showColumnHeaders: true,
      showRowHeaders: true,
      rowHeaders: ["Row 1", "Row 2"],
      rows: [
        ["", "", ""],
        ["", "", ""],
      ],
    }
  }
  if (type === "presentation") {
    return {
      kind: "presentation" as const,
      slides: [
        {
          id: "slide-1",
          title: "Opening slide",
          body: paragraphDocument("Add the main point for this slide."),
        },
      ],
    }
  }
  return { kind: "text" as const, body: paragraphDocument("") }
}
