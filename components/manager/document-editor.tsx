"use client"

import { useEffect, useState } from "react"
import {
  ArrowLeft,
  FileText,
  FileUp,
  Image as ImageIcon,
  Link2,
  Users,
  X,
} from "lucide-react"

import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { BANNER_IMAGE_ACCEPT } from "@/lib/banner-image"
import {
  formatFileSize,
  isValidSharedLink,
  type WorkspaceDocument,
} from "@/lib/documents"
import { slugify } from "@/lib/operations"
import { cn } from "@/lib/utils"

function cloneDocument(document: WorkspaceDocument) {
  return JSON.parse(JSON.stringify(document)) as WorkspaceDocument
}

function newDocument(): WorkspaceDocument {
  return {
    id: "",
    title: "",
    description: "",
    employees: [],
    published: false,
    updatedAt: Date.now(),
  }
}

export function DocumentEditor({ documentId }: { documentId?: string }) {
  const { documents, employees, saveDocument, showFeedback } = useOperations()
  const existing = documentId
    ? documents.find((document) => document.id === documentId)
    : undefined
  const [draft, setDraft] = useState<WorkspaceDocument | null>(() =>
    documentId ? (existing ? cloneDocument(existing) : null) : newDocument()
  )
  const [resourceMode, setResourceMode] = useState<"file" | "link">(
    draft?.resource?.kind ?? "file"
  )
  const [resourceFile, setResourceFile] = useState<File>()
  const [linkUrl, setLinkUrl] = useState(
    draft?.resource?.kind === "link" ? draft.resource.url : ""
  )
  const [bannerFile, setBannerFile] = useState<File>()
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string>()
  const [removeBanner, setRemoveBanner] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const { leaveWithoutPrompt, requestLeave } = useUnsavedChanges({
    dirty,
    itemName: "document",
    toastId: "discard-document-changes",
    onDiscard: () => setDirty(false),
  })

  useEffect(
    () => () => {
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl)
    },
    [bannerPreviewUrl]
  )

  function markChanged() {
    setDirty(true)
    setError("")
  }

  function changeBase(
    patch: Partial<
      Pick<WorkspaceDocument, "title" | "description" | "published">
    >
  ) {
    if (!draft) return
    setDraft({ ...draft, ...patch })
    markChanged()
  }

  function leave() {
    requestLeave("/manager/documents")
  }

  async function submit() {
    if (!draft) return
    if (!draft.title.trim() || !draft.description.trim()) {
      return setError("Add a name and description.")
    }
    if (
      resourceMode === "file" &&
      !resourceFile &&
      draft.resource?.kind !== "file"
    ) {
      return setError("Choose a file to upload.")
    }
    if (resourceMode === "link" && !isValidSharedLink(linkUrl.trim())) {
      return setError("Add a valid HTTP or HTTPS shared link.")
    }

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

    const resource =
      resourceMode === "link"
        ? ({ kind: "link", url: linkUrl.trim() } as const)
        : draft.resource?.kind === "file"
          ? draft.resource
          : undefined

    setSaving(true)
    try {
      await saveDocument(
        {
          ...draft,
          id,
          title: draft.title.trim(),
          description: draft.description.trim(),
          resource,
          updatedAt: Date.now(),
        },
        {
          resourceFile: resourceMode === "file" ? resourceFile : undefined,
          bannerFile,
          removeBanner,
        }
      )
      setDirty(false)
      showFeedback(draft.id ? "Document saved." : "Document shared.")
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

  const visibleBanner =
    bannerPreviewUrl ?? (!removeBanner ? draft.bannerImageUrl : undefined)
  const currentFile =
    resourceMode === "file" && draft.resource?.kind === "file"
      ? draft.resource
      : undefined

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={leave}>
          <ArrowLeft /> Back to documents
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {draft.id ? "Edit document" : "Share a document"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add the details, choose who it relates to, then upload a file or share
          a link from Google, Microsoft, or another service.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Name" id="document-name">
                <Input
                  id="document-name"
                  value={draft.title}
                  onChange={(event) =>
                    changeBase({ title: event.target.value })
                  }
                  placeholder="Opening checklist"
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
                  placeholder="Explain what this resource contains and when to use it."
                  className="min-h-24 border border-input px-3"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">File or shared link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="grid grid-cols-2 gap-2"
                aria-label="Resource type"
              >
                <Button
                  type="button"
                  variant={resourceMode === "file" ? "default" : "outline"}
                  onClick={() => {
                    setResourceMode("file")
                    markChanged()
                  }}
                  aria-pressed={resourceMode === "file"}
                >
                  <FileUp /> Upload file
                </Button>
                <Button
                  type="button"
                  variant={resourceMode === "link" ? "default" : "outline"}
                  onClick={() => {
                    setResourceMode("link")
                    markChanged()
                  }}
                  aria-pressed={resourceMode === "link"}
                >
                  <Link2 /> Share link
                </Button>
              </div>

              {resourceMode === "file" ? (
                <div className="space-y-3">
                  <Label htmlFor="document-file">Choose file</Label>
                  <Input
                    id="document-file"
                    type="file"
                    onChange={(event) => {
                      setResourceFile(event.target.files?.[0])
                      markChanged()
                    }}
                    className="border border-input px-3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload documents, spreadsheets, presentations, PDFs, images,
                    or other files your team needs.
                  </p>
                  {(resourceFile || currentFile) && (
                    <div className="flex items-center gap-3 border bg-muted/30 p-3">
                      <FileText className="size-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {resourceFile?.name ?? currentFile?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(
                            resourceFile?.size ?? currentFile?.size ?? 0
                          )}
                          {resourceFile ? " · Ready to upload" : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Field label="Shared link" id="document-link">
                  <Input
                    id="document-link"
                    type="url"
                    inputMode="url"
                    value={linkUrl}
                    onChange={(event) => {
                      setLinkUrl(event.target.value)
                      markChanged()
                    }}
                    placeholder="https://docs.google.com/…"
                    className="border border-input px-3"
                  />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> Related employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Select employees"
              >
                {employees
                  .filter(
                    (employee) =>
                      employee.status !== "deactivated" ||
                      draft.employees.some(
                        (selected) => selected.id === employee.id
                      )
                  )
                  .map((employee) => {
                    const selected = draft.employees.some(
                      (item) => item.id === employee.id
                    )
                    return (
                      <Button
                        key={employee.id}
                        type="button"
                        size="xs"
                        variant={selected ? "default" : "outline"}
                        className={selected ? undefined : "bg-background"}
                        aria-pressed={selected}
                        onClick={() => {
                          setDraft({
                            ...draft,
                            employees: selected
                              ? draft.employees.filter(
                                  (item) => item.id !== employee.id
                                )
                              : [
                                  ...draft.employees,
                                  {
                                    id: employee.id,
                                    displayName: employee.displayName,
                                  },
                                ],
                          })
                          markChanged()
                        }}
                      >
                        {employee.displayName}
                      </Button>
                    )
                  })}
                {!employees.length && (
                  <p className="text-sm text-muted-foreground">
                    Create employee profiles first, or share this resource
                    without related employees.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Banner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className={cn(
                  "flex aspect-[16/7] items-center justify-center overflow-hidden border bg-muted/40 bg-cover bg-center",
                  visibleBanner && "text-transparent"
                )}
                style={
                  visibleBanner
                    ? { backgroundImage: `url("${visibleBanner}")` }
                    : undefined
                }
                role={visibleBanner ? "img" : undefined}
                aria-label={
                  visibleBanner ? "Document banner preview" : undefined
                }
              >
                {!visibleBanner && (
                  <ImageIcon className="size-7 text-muted-foreground" />
                )}
              </div>
              <Label htmlFor="document-banner">Banner image</Label>
              <Input
                id="document-banner"
                type="file"
                accept={BANNER_IMAGE_ACCEPT}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setBannerFile(file)
                  setRemoveBanner(false)
                  setBannerPreviewUrl(
                    file ? URL.createObjectURL(file) : undefined
                  )
                  markChanged()
                }}
                className="border border-input px-3"
              />
              <p className="text-xs text-muted-foreground">
                Optional. JPG, PNG, WebP, or AVIF up to 10 MB.
              </p>
              {visibleBanner && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBannerFile(undefined)
                    setBannerPreviewUrl(undefined)
                    setRemoveBanner(true)
                    markChanged()
                  }}
                >
                  <X /> Remove banner
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="space-y-4">
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
              <p className="text-xs text-muted-foreground">
                Published resources appear in the employee document library.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

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
