"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

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

import { RelatedGuidesPicker } from "@/components/manager/related-guides-picker"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppMessageKey } from "@/i18n/messages"
import { Textarea } from "@/components/ui/textarea"
import { BANNER_IMAGE_ACCEPT } from "@/lib/banner-image"
import {
  formatFileSize,
  isValidSharedLink,
  type EditableDocument,
} from "@/lib/documents"
import { slugify } from "@/lib/operations"
import { cn } from "@/lib/utils"

function cloneDocument(document: EditableDocument) {
  return JSON.parse(JSON.stringify(document)) as EditableDocument
}

function newDocument(): EditableDocument {
  return {
    id: "",
    title: "",
    description: "",
    employees: [],
    relatedGuideIds: [],
    published: true,
    updatedAt: Date.now(),
  }
}

export function DocumentEditor({ documentId }: { documentId?: string }) {
  const t = useAppTranslations()
  const { documents, employees, guideReferences, saveDocument, showFeedback } =
    useOperations()
  const existing = documentId
    ? documents.find((document) => document.id === documentId)
    : undefined
  const [draft, setDraft] = useState<EditableDocument | null>(() =>
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
      Pick<EditableDocument, "title" | "description" | "published">
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
      return setError("addANameAndDescription")
    }
    if (
      resourceMode === "file" &&
      !resourceFile &&
      draft.resource?.kind !== "file"
    ) {
      return setError("chooseAFileToUpload")
    }
    if (resourceMode === "link" && !isValidSharedLink(linkUrl.trim())) {
      return setError("addValidhttphttpsSharedLink")
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
      showFeedback(draft.id ? "documentSaved" : "documentShared")
      leaveWithoutPrompt("/manager/documents")
    } finally {
      setSaving(false)
    }
  }

  if (!draft)
    return (
      <EmptyState
        icon={FileText}
        title="documentNotFound"
        description="documentRemovedCurrentHub"
        actionLabel="backToDocuments"
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
          <ArrowLeft /> <T>backToDocuments</T>
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          <T>{draft.id ? "editDocument" : "shareADocument"}</T>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <T>addDetailsChooseWhoRelatesThenUploadMessage</T>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                <T>details</T>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="name" id="document-name">
                <Input
                  id="document-name"
                  value={draft.title}
                  onChange={(event) =>
                    changeBase({ title: event.target.value })
                  }
                  placeholder={t("openingChecklist")}
                  className="border border-input px-3 text-base"
                />
              </Field>
              <Field label="description" id="document-description">
                <Textarea
                  id="document-description"
                  value={draft.description}
                  onChange={(event) =>
                    changeBase({ description: event.target.value })
                  }
                  placeholder={t("explainWhatResourceContainsUse")}
                  className="min-h-24 border border-input px-3"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                <T>fileOrSharedLink</T>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="grid grid-cols-2 gap-2"
                aria-label={t("resourceType")}
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
                  <FileUp /> <T>uploadFile</T>
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
                  <Link2 /> <T>shareLink</T>
                </Button>
              </div>

              {resourceMode === "file" ? (
                <div className="space-y-3">
                  <Label htmlFor="document-file">
                    <T>chooseFile</T>
                  </Label>
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
                    <T>
                      uploadDocumentsSpreadsheetsPresentationsPdfsImagesOtherMessage
                    </T>
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
                          {resourceFile && (
                            <>
                              {" "}
                              <T>readyToUploadListSuffix</T>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Field label="sharedLink" id="document-link">
                  <Input
                    id="document-link"
                    type="url"
                    inputMode="url"
                    value={linkUrl}
                    onChange={(event) => {
                      setLinkUrl(event.target.value)
                      markChanged()
                    }}
                    placeholder={t("sharedDocumentUrlExample")}
                    className="border border-input px-3"
                  />
                </Field>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> <T>relatedEmployees</T>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex flex-wrap gap-2"
                aria-label={t("selectEmployees")}
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
                    <T>
                      createEmployeeProfilesFirstShareResourceWithoutMessage
                    </T>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit shadow-none">
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) =>
                    changeBase({ published: event.target.checked })
                  }
                />
                <T>publishNow</T>
              </label>
              <p className="text-xs text-muted-foreground">
                <T>publishedResourcesAppearEmployeeDocumentLibrary</T>
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold">
                <T>banner</T>
              </h2>
              <div
                className={cn(
                  "flex aspect-[16/7] w-full max-w-full items-center justify-center overflow-hidden border bg-muted/40 bg-cover bg-center",
                  visibleBanner && "text-transparent"
                )}
                style={
                  visibleBanner
                    ? { backgroundImage: `url("${visibleBanner}")` }
                    : undefined
                }
                role={visibleBanner ? "img" : undefined}
                aria-label={
                  visibleBanner ? t("documentBannerPreview") : undefined
                }
              >
                {!visibleBanner && (
                  <ImageIcon className="size-7 text-muted-foreground" />
                )}
              </div>
              <Label htmlFor="document-banner">
                <T>bannerImage</T>
              </Label>
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
                <T>optionaljpgpngWebpavifUpMessage</T>
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
                  <X /> <T>removeBanner</T>
                </Button>
              )}
            </section>

            <RelatedGuidesPicker
              guides={guideReferences}
              selectedIds={draft.relatedGuideIds ?? []}
              onChange={(relatedGuideIds) => {
                setDraft({ ...draft, relatedGuideIds })
                markChanged()
              }}
            />
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              <T>{error}</T>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <T>{dirty ? "unsavedChanges" : "noUnsavedChanges"}</T>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={leave}>
            <T>cancel</T>
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            <T>{saving ? "saving" : "saveDocument"}</T>
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
  label: AppMessageKey
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <T>{label}</T>
      </Label>
      {children}
    </div>
  )
}
