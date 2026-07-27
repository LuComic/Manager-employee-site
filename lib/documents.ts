export type DocumentEmployee = {
  id?: string
  displayName: string
}

export type UploadedDocumentResource = {
  kind: "file"
  name: string
  contentType: string
  size: number
  url: string
}

export type LinkedDocumentResource = {
  kind: "link"
  url: string
}

export type DocumentResource = UploadedDocumentResource | LinkedDocumentResource

export type WorkspaceDocument = {
  id: string
  title: string
  description: string
  resource: DocumentResource
  employees: DocumentEmployee[]
  bannerImageUrl?: string
  published: boolean
  updatedAt: number
}

export type EditableDocument = Omit<WorkspaceDocument, "resource"> & {
  resource?: DocumentResource
}

export type DocumentUploadChanges = {
  resourceFile?: File
  bannerFile?: File
  removeBanner?: boolean
}

export function isValidSharedLink(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export function documentResourceLabelKey(
  resource?: DocumentResource
): AppMessageKey {
  if (!resource) return "file"
  if (resource.kind === "link") {
    return "sharedLink"
  }
  if (resource.contentType.startsWith("image/")) return "image"
  if (resource.contentType === "application/pdf") return "pdf"
  if (
    resource.contentType.includes("presentation") ||
    resource.contentType.includes("powerpoint")
  )
    return "presentation"
  if (
    resource.contentType.includes("spreadsheet") ||
    resource.contentType.includes("excel") ||
    resource.contentType === "text/csv"
  )
    return "spreadsheet"
  if (
    resource.contentType.includes("document") ||
    resource.contentType.includes("word")
  )
    return "document"
  return "file"
}

export function sharedLinkHost(resource: LinkedDocumentResource) {
  try {
    return new URL(resource.url).hostname.replace(/^www\./, "")
  } catch {
    return undefined
  }
}
import type { AppMessageKey } from "@/i18n/messages"
