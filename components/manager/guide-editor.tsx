"use client"

import { useState } from "react"
import { ArrowLeft, Eye, Pencil, X } from "lucide-react"

import { GuideDetail } from "@/components/knowledge-base/guide-detail"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
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
    content: cloneContent(guide.content),
    published: Boolean(guide.published),
    featured: Boolean(guide.featured),
    icon: guide.icon,
  }
}

export function GuideEditor({ guideId }: { guideId?: string }) {
  const { categories, guides, saveGuide, showFeedback } = useOperations()
  const existingGuide = guideId
    ? guides.find((guide) => guide.id === guideId)
    : undefined
  const [draft, setDraft] = useState<GuideDraft | null>(() => {
    if (guideId) return existingGuide ? toDraft(existingGuide) : null
    const category = categories[0]
    if (!category) return null
    return {
      id: "",
      title: "",
      description: "",
      category: category.id,
      duration: "5 min",
      keywords: [],
      content: cloneContent(emptyRichTextDocument),
      published: false,
      featured: false,
      icon: getCategoryIcon(category.iconKey),
    }
  })
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [keywordInput, setKeywordInput] = useState("")
  const { leaveWithoutPrompt, requestLeave } = useUnsavedChanges({
    dirty,
    itemName: "guide",
    toastId: "discard-guide-changes",
    onDiscard: () => setDirty(false),
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

  async function submit() {
    if (!draft) return
    const duration = normalizeReadingTime(draft.duration)
    if (
      !draft.title.trim() ||
      !draft.description.trim() ||
      !duration ||
      !draft.category
    )
      return setError("Add a title, description, work area, and reading time.")
    if (isRichTextEmpty(draft.content))
      return setError("Add guide instructions.")

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
        content: draft.content,
        published: draft.published,
        featured: draft.featured,
      })
      setDirty(false)
      showFeedback(draft.id ? "Guide saved." : "Guide created.")
      leaveWithoutPrompt("/manager/guides")
    } finally {
      setSaving(false)
    }
  }

  if (!categories.length)
    return (
      <EmptyState
        icon={Pencil}
        title="Create a guide category first"
        description="Every guide needs a work area. Add a category, then return to create the guide."
        actionLabel="Manage categories"
        actionHref="/manager/categories"
      />
    )

  if (!draft)
    return (
      <EmptyState
        icon={Pencil}
        title="Guide not found"
        description="This guide may have been removed from the current session."
        actionLabel="Back to guides"
        actionHref="/manager/guides"
      />
    )

  const previewGuide: Guide = {
    id: draft.id || "preview",
    title: draft.title || "Untitled guide",
    description: draft.description || "Add a short guide description.",
    category: draft.category,
    icon: draft.icon,
    duration: normalizeReadingTime(draft.duration) || "Reading time",
    updated: draft.id ? "Updated just now" : "New guide",
    keywords: uniqueKeywords(draft.keywords),
    content: draft.content,
    published: draft.published,
    featured: draft.featured,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={leave}>
            <ArrowLeft /> Back to guides
          </Button>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {draft.id ? "Edit guide" : "Create guide"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Write clear instructions and preview how employees will read them.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "edit" ? "secondary" : "outline"}
            onClick={() => setMode("edit")}
          >
            <Pencil /> Edit
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
        <div className="border bg-muted/20 p-4 sm:p-8">
          <GuideDetail
            guide={previewGuide}
            category={categories.find(
              (category) => category.id === draft.category
            )}
            preview
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <Card className="shadow-none">
              <CardContent className="space-y-4">
                <Field label="Title" id="guide-title">
                  <Input
                    id="guide-title"
                    value={draft.title}
                    onChange={(event) => change({ title: event.target.value })}
                    className="border border-input px-3 text-base"
                  />
                </Field>
                <Field label="Description" id="guide-description">
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
              <Label className="mb-2 block">Instructions</Label>
              <RichTextEditor
                value={draft.content}
                onChange={(content) => change({ content })}
                ariaLabel="Guide instructions"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Use headings and lists to make longer instructions easy to scan.
              </p>
            </div>
          </div>

          <Card className="h-fit shadow-none">
            <CardContent className="space-y-4">
              <Field label="Work area" id="guide-category">
                <Select
                  value={draft.category}
                  onValueChange={(value) => {
                    if (!value) return
                    const category = categories.find(
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
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Reading time" id="guide-duration">
                <Input
                  id="guide-duration"
                  value={draft.duration}
                  onChange={(event) => change({ duration: event.target.value })}
                  onBlur={() => {
                    const duration = normalizeReadingTime(draft.duration)
                    if (duration && duration !== draft.duration)
                      change({ duration })
                  }}
                  placeholder="5 min"
                  className="border border-input px-3"
                />
              </Field>
              <Field label="Keywords" id="guide-keywords">
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
                    placeholder="Type a keyword"
                    className="min-w-0 border border-input px-3"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addKeyword}
                    disabled={!keywordInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter or choose Add after each keyword.
                </p>
                {draft.keywords.length ? (
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Guide keywords"
                  >
                    {draft.keywords.map((keyword, index) => (
                      <button
                        type="button"
                        key={`${keyword}-${index}`}
                        onClick={() => removeKeyword(index)}
                        aria-label={`Remove ${keyword}`}
                        className="inline-flex h-7 items-center gap-1.5 border border-muted bg-muted px-2.5 text-xs font-medium transition-colors hover:border-border hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
                      >
                        <span>{keyword}</span>
                        <X className="size-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) =>
                    change({ published: event.target.checked })
                  }
                />
                Publish now
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(event) =>
                    change({ featured: event.target.checked })
                  }
                />
                Feature on Today
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
            {saving ? "Saving…" : "Save guide"}
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
