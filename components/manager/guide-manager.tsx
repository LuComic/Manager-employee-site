"use client"

import { useMemo, useState } from "react"
import { BookOpen, FilePenLine, Plus, Search, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { categories, type CategoryId, type Guide } from "@/lib/knowledge-base"
import { slugify } from "@/lib/operations"

type Status = "All" | "Published" | "Draft"
type GuideDraft = {
  id: string
  title: string
  description: string
  category: CategoryId
  duration: string
  keywords: string
  steps: string
  published: boolean
  featured: boolean
}

const blankGuide: GuideDraft = {
  id: "",
  title: "",
  description: "",
  category: "register",
  duration: "5 min",
  keywords: "",
  steps: "First step | Describe what to do.",
  published: false,
  featured: false,
}

function toDraft(guide: Guide): GuideDraft {
  return {
    id: guide.id,
    title: guide.title,
    description: guide.description,
    category: guide.category,
    duration: guide.duration,
    keywords: (guide.keywords ?? []).join(", "),
    steps: guide.steps
      .map((step) => `${step.title} | ${step.detail}`)
      .join("\n"),
    published: Boolean(guide.published),
    featured: Boolean(guide.featured),
  }
}

export function GuideManager() {
  const { guides, saveGuide, deleteGuide, showFeedback } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [editing, setEditing] = useState<GuideDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Guide | null>(null)
  const [error, setError] = useState("")
  const visible = useMemo(
    () =>
      guides.filter((guide) => {
        const matchesQuery = `${guide.title} ${guide.description}`
          .toLowerCase()
          .includes(query.toLowerCase())
        const matchesStatus =
          status === "All" ||
          (status === "Published" ? guide.published : !guide.published)
        return matchesQuery && matchesStatus
      }),
    [guides, query, status]
  )

  function submit() {
    if (!editing) return
    const parsedSteps = editing.steps
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, ...detail] = line.split("|")
        return { title: title.trim(), detail: detail.join("|").trim() }
      })
    if (
      !editing.title.trim() ||
      !editing.description.trim() ||
      !editing.duration.trim()
    )
      return setError("Add a title, description, and reading time.")
    if (
      !parsedSteps.length ||
      parsedSteps.some((step) => !step.title || !step.detail)
    )
      return setError(
        "Add at least one instruction using “Step title | Details”, one per line."
      )
    const category =
      categories.find((item) => item.id === editing.category) ?? categories[0]
    let id = editing.id || slugify(editing.title)
    if (!editing.id && guides.some((guide) => guide.id === id))
      id = `${id}-${Date.now()}`
    saveGuide({
      id,
      title: editing.title.trim(),
      description: editing.description.trim(),
      category: editing.category,
      icon: category.icon,
      duration: editing.duration.trim(),
      updated: "Updated just now",
      keywords: editing.keywords
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      steps: parsedSteps,
      published: editing.published,
      featured: editing.featured,
    })
    showFeedback(editing.id ? "Guide saved." : "Guide created.")
    setEditing(null)
    setError("")
  }

  return (
    <div className="space-y-8">
      <ManagerHeading
        title="Manage guides"
        description="Create, edit, publish, and remove practical instructions."
        action={
          <Button
            onClick={() => {
              setEditing({ ...blankGuide })
              setError("")
            }}
          >
            <Plus /> New guide
          </Button>
        }
      />
      <div className="flex flex-col gap-4 border bg-background p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides…"
            aria-label="Search guides"
            className="border border-input pr-3 pl-10"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as Status)}
          className="h-10 border bg-background px-3 text-sm"
          aria-label="Filter guides by status"
        >
          <option>All</option>
          <option>Published</option>
          <option>Draft</option>
        </select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((guide) => (
            <Card key={guide.id} className="shadow-none">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{guide.title}</h3>
                    <Badge variant={guide.published ? "secondary" : "outline"}>
                      {guide.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {guide.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      saveGuide({
                        ...guide,
                        published: !guide.published,
                        updated: "Updated just now",
                      })
                      showFeedback(
                        guide.published
                          ? "Guide unpublished."
                          : "Guide published."
                      )
                    }}
                  >
                    {guide.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(toDraft(guide))
                      setError("")
                    }}
                  >
                    <FilePenLine /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(guide)}
                    aria-label={`Delete ${guide.title}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No matching guides"
          description="Clear the search or choose another status filter."
        />
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setError("")
          }
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          {editing && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  {editing.id ? "Edit guide" : "Create guide"}
                </DialogTitle>
                <DialogDescription>
                  Published guides appear immediately on the employee site and
                  in search.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 grid gap-4 sm:grid-cols-2">
                <Field label="Title" id="guide-title" className="sm:col-span-2">
                  <Input
                    id="guide-title"
                    value={editing.title}
                    onChange={(event) =>
                      setEditing({ ...editing, title: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field
                  label="Description"
                  id="guide-description"
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="guide-description"
                    value={editing.description}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        description: event.target.value,
                      })
                    }
                    className="min-h-20 border border-input px-3"
                  />
                </Field>
                <Field label="Work area" id="guide-category">
                  <select
                    id="guide-category"
                    value={editing.category}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        category: event.target.value as CategoryId,
                      })
                    }
                    className="h-10 w-full border bg-background px-3 text-sm"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Reading time" id="guide-duration">
                  <Input
                    id="guide-duration"
                    value={editing.duration}
                    onChange={(event) =>
                      setEditing({ ...editing, duration: event.target.value })
                    }
                    placeholder="5 min"
                    className="border border-input px-3"
                  />
                </Field>
                <Field
                  label="Keywords, separated by commas"
                  id="guide-keywords"
                  className="sm:col-span-2"
                >
                  <Input
                    id="guide-keywords"
                    value={editing.keywords}
                    onChange={(event) =>
                      setEditing({ ...editing, keywords: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field
                  label="Instructions — one “Step title | Details” per line"
                  id="guide-steps"
                  className="sm:col-span-2"
                >
                  <Textarea
                    id="guide-steps"
                    value={editing.steps}
                    onChange={(event) =>
                      setEditing({ ...editing, steps: event.target.value })
                    }
                    className="min-h-32 border border-input px-3 font-mono text-xs"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.published}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        published: event.target.checked,
                      })
                    }
                  />{" "}
                  Publish now
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.featured}
                    onChange={(event) =>
                      setEditing({ ...editing, featured: event.target.checked })
                    }
                  />{" "}
                  Feature on Today
                </label>
                {error && (
                  <p
                    role="alert"
                    className="text-sm text-destructive sm:col-span-2"
                  >
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null)
                    setError("")
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Save guide</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? "guide"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteGuide(deleteTarget.id)
            showFeedback("Guide deleted.")
          }
        }}
      />
    </div>
  )
}

function Field({
  label,
  id,
  className,
  children,
}: {
  label: string
  id: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
