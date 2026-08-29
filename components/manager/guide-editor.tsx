"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { useState } from "react"
import { ArrowLeft, Eye, Pencil, X } from "lucide-react"

import { GuideDetail } from "@/components/knowledge-base/guide-detail"
import { RelatedGuidesPicker } from "@/components/manager/related-guides-picker"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { Button } from "@/components/ui/button"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppMessageKey } from "@/i18n/messages"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getCategoryIcon } from "@/lib/category-icons"
import type { Guide } from "@/lib/knowledge-base"
import { normalizeReadingTime, slugify } from "@/lib/operations"
import {
  emptyRichTextDocument,
  isRichTextEmpty,
  type RichTextDocument,
} from "@/lib/rich-text"

type GuideDraft = {
  id: string
  title: string
  description: string
  category: string
  duration: string
  keywords: string[]
  relatedGuideIds: string[]
  content: RichTextDocument
  published: boolean
  featured: boolean
  icon: Guide["icon"]
}

function cloneContent(content: RichTextDocument) {
  return JSON.parse(JSON.stringify(content)) as RichTextDocument
}

function uniqueKeywords(keywords: string[]) {
  const seen = new Set<string>()
  return keywords.filter((keyword) => {
    const key = keyword.trim().toLocaleLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function toDraft(guide: Guide): GuideDraft {
  return {
    id: guide.id,
    title: guide.title,
    description: guide.description,
    category: guide.category,
    duration: guide.duration,
    keywords: uniqueKeywords(guide.keywords ?? []),
    relatedGuideIds: guide.relatedGuideIds ?? [],
    content: cloneContent(guide.content),
    published: Boolean(guide.published),
    featured: Boolean(guide.featured),
    icon: guide.icon,
  }
}

export function GuideEditor({ guideId }: { guideId?: string }) {
  const t = useAppTranslations()
  const { guideCategories, guides, guideReferences, saveGuide, showFeedback } =
    useOperations()
  const existingGuide = guideId
    ? guides.find((guide) => guide.id === guideId)
    : undefined
  const [draft, setDraft] = useState<GuideDraft | null>(() => {
    if (guideId) return existingGuide ? toDraft(existingGuide) : null
    const category = guideCategories[0]
    if (!category) return null
    return {
      id: "",
      title: "",
      description: "",
      category: category.id,
      duration: "5 min",
      keywords: [],
      relatedGuideIds: [],
      content: cloneContent(emptyRichTextDocument),
      published: true,
      featured: false,
      icon: getCategoryIcon(category.iconKey),
    }
  })
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [keywordInput, setKeywordInput] = useState("")
  const canSaveDraft = Boolean(
    draft &&
    draft.title.trim() &&
    draft.description.trim() &&
    normalizeReadingTime(draft.duration) &&
    draft.category &&
    !isRichTextEmpty(draft.content)
  )
  const { leaveWithoutPrompt, requestLeave } = useUnsavedChanges({
    dirty,
    itemName: "guide",
    toastId: "discard-guide-changes",
    onDiscard: () => setDirty(false),
    onSaveDraft: canSaveDraft ? () => save(true) : undefined,
  })

  function change(patch: Partial<GuideDraft>) {
    if (!draft) return
    setDraft({ ...draft, ...patch })
    setDirty(true)
  }

  function leave() {
    requestLeave("/manager/guides")
  }

  function addKeyword() {
    if (!draft) return
    const keyword = keywordInput.trim()
    if (!keyword) return
    if (
      draft.keywords.some(
        (item) => item.toLocaleLowerCase() === keyword.toLocaleLowerCase()
      )
    )
      return
    change({ keywords: [...draft.keywords, keyword] })
    setKeywordInput("")
  }

  function removeKeyword(index: number) {
    if (!draft) return
    change({
      keywords: draft.keywords.filter(
        (_, keywordIndex) => keywordIndex !== index
      ),
    })
  }

  async function save(asDraft = false) {
    if (!draft) return false
    const duration = normalizeReadingTime(draft.duration)
    if (
      !draft.title.trim() ||
      !draft.description.trim() ||
      !duration ||
      !draft.category
    ) {
      setError("addTitleDescriptionWorkAreaReadingTime")
      return false
    }
    if (isRichTextEmpty(draft.content)) {
      setError("addGuideInstructions")
      return false
    }

    let id = draft.id
    if (!id) {
      const base = slugify(draft.title) || "guide"
      id = base
      let suffix = 2
      while (guides.some((guide) => guide.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }
    setSaving(true)
    try {
      await saveGuide({
        id,
        title: draft.title.trim(),
        description: draft.description.trim(),
        category: draft.category,
        icon: draft.icon,
        duration,
        updated: "Updated just now",
        keywords: uniqueKeywords(draft.keywords),
        relatedGuideIds: draft.relatedGuideIds,
        content: draft.content,
        published: asDraft ? false : draft.published,
        featured: draft.featured,
      })
      setDirty(false)
      showFeedback(
        asDraft ? "savedAsDraft" : draft.id ? "guideSaved" : "guideCreated"
      )
      return true
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (await save()) leaveWithoutPrompt("/manager/guides")
  }

  if (!guideCategories.length)
    return (
      <EmptyState
        icon={Pencil}
        title="createAGuideCategoryFirst"
        description="everyGuideNeedsWorkAreaAddCategoryMessage"
        actionLabel="manageCategories"
        actionHref="/manager/categories"
      />
    )

  if (!draft)
    return (
      <EmptyState
        icon={Pencil}
        title="guideNotFound"
        description="guideRemovedCurrentSession"
        actionLabel="backToGuides"
        actionHref="/manager/guides"
      />
    )

  const previewGuide: Guide = {
    id: draft.id || "preview",
    title: draft.title || t("untitledGuide"),
    description: draft.description || t("addShortGuideDescription"),
    category: draft.category,
    icon: draft.icon,
    duration: normalizeReadingTime(draft.duration) || t("readingTime"),
    updated: draft.id ? t("updatedJustNow") : t("newGuide"),
    keywords: uniqueKeywords(draft.keywords),
    relatedGuideIds: draft.relatedGuideIds,
    content: draft.content,
    published: draft.published,
    featured: draft.featured,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={leave}>
            <ArrowLeft /> <T>backToGuides</T>
          </Button>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            <T>{draft.id ? "editGuide" : "createGuide"}</T>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <T>writeClearInstructionsPreviewHowEmployeesRead</T>
          </p>
        </div>
        <SegmentedControl
          className="grid w-full grid-cols-2 sm:w-auto"
          aria-label={t("guideEditorView")}
        >
          <SegmentedControlItem
            type="button"
            selected={mode === "edit"}
            onClick={() => setMode("edit")}
          >
            <Pencil /> <T>edit</T>
          </SegmentedControlItem>
          <SegmentedControlItem
            type="button"
            selected={mode === "preview"}
            onClick={() => setMode("preview")}
          >
            <Eye /> <T>preview</T>
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      {mode === "preview" ? (
        <div className="border bg-muted/20 p-4 sm:p-6">
          <GuideDetail
            guide={previewGuide}
            category={guideCategories.find(
              (category) => category.id === draft.category
            )}
            relatedGuides={guides.filter(
              (guide) =>
                guide.published &&
                guide.id !== draft.id &&
                draft.relatedGuideIds.includes(guide.id)
            )}
            preview
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <Card className="shadow-none">
              <CardContent className="space-y-4">
                <Field label="title" id="guide-title">
                  <Input
                    id="guide-title"
                    value={draft.title}
                    onChange={(event) => change({ title: event.target.value })}
                    className="border border-input px-3 text-base"
                  />
                </Field>
                <Field label="description" id="guide-description">
                  <Textarea
                    id="guide-description"
                    value={draft.description}
                    onChange={(event) =>
                      change({ description: event.target.value })
                    }
                    className="min-h-24 border border-input px-3"
                  />
                </Field>
              </CardContent>
            </Card>
            <div>
              <Label className="mb-2 block">
                <T>instructions</T>
              </Label>
              <RichTextEditor
                value={draft.content}
                onChange={(content) => change({ content })}
                ariaLabel="Guide instructions"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                <T>useHeadingsListsMakeLongerInstructionsEasyMessage</T>
              </p>
            </div>
          </div>

          <Card className="h-fit shadow-none">
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) =>
                    change({ published: event.target.checked })
                  }
                />
                <T>publishNow</T>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(event) =>
                    change({ featured: event.target.checked })
                  }
                />
                <T>featureOnToday</T>
              </label>
              <Field label="category" id="guide-category">
                <Select
                  value={draft.category}
                  onValueChange={(value) => {
                    if (!value) return
                    const category = guideCategories.find(
                      (item) => item.id === value
                    )
                    change({
                      category: value,
                      ...(!draft.id && category
                        ? { icon: getCategoryIcon(category.iconKey) }
                        : {}),
                    })
                  }}
                >
                  <SelectTrigger
                    id="guide-category"
                    className="w-full border border-input bg-background px-3"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {guideCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="readingTime" id="guide-duration">
                <Input
                  id="guide-duration"
                  value={draft.duration}
                  onChange={(event) => change({ duration: event.target.value })}
                  onBlur={() => {
                    const duration = normalizeReadingTime(draft.duration)
                    if (duration && duration !== draft.duration)
                      change({ duration })
                  }}
                  placeholder={t("fiveMinutes")}
                  className="border border-input px-3"
                />
              </Field>
              <Field label="keywords" id="guide-keywords">
                <div className="flex gap-2">
                  <Input
                    id="guide-keywords"
                    value={keywordInput}
                    onChange={(event) => setKeywordInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      event.preventDefault()
                      addKeyword()
                    }}
                    placeholder={t("typeAKeyword")}
                    className="min-w-0 border border-input px-3"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addKeyword}
                    disabled={!keywordInput.trim()}
                  >
                    <T>add</T>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  <T>pressEnterChooseAddAfterEachKeyword</T>
                </p>
                {draft.keywords.length ? (
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label={t("guideKeywords")}
                  >
                    {draft.keywords.map((keyword, index) => (
                      <button
                        type="button"
                        key={`${keyword}-${index}`}
                        onClick={() => removeKeyword(index)}
                        aria-label={t("removeName", { name: keyword })}
                        className="inline-flex h-7 items-center gap-1.5 border border-muted bg-muted px-2.5 text-xs font-medium transition-colors hover:border-border hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                      >
                        <span>{keyword}</span>
                        <X className="size-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </Field>
              <RelatedGuidesPicker
                guides={guideReferences}
                selectedIds={draft.relatedGuideIds}
                onChange={(relatedGuideIds) => change({ relatedGuideIds })}
                excludeGuideId={draft.id || undefined}
              />
            </CardContent>
          </Card>
        </div>
      )}

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
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={leave}
          >
            <T>cancel</T>
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => void submit()}
            disabled={saving}
          >
            <T>{saving ? "saving" : "saveGuide"}</T>
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
