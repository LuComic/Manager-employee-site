"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { useState } from "react"
import { Link } from "@/i18n/navigation"
import {
  ArrowDown,
  ArrowUp,
  FilePenLine,
  Plus,
  Tags,
  Trash2,
} from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import {
  categoryIconOptions,
  CategoryIcon,
  type CategoryIconKey,
} from "@/lib/category-icons"
import type { Category } from "@/lib/knowledge-base"
import { slugify } from "@/lib/operations"
import { cn } from "@/lib/utils"

type CategoryDraft = {
  id: string
  label: string
  description: string
  iconKey: CategoryIconKey
}

const blankCategory: CategoryDraft = {
  id: "",
  label: "",
  description: "",
  iconKey: "general",
}

export function CategoryManager() {
  const t = useAppTranslations()
  const {
    categories,
    guides,
    canCreateContent,
    saveCategory,
    moveCategory,
    deleteCategory,
    showFeedback,
  } = useOperations()
  const [editing, setEditing] = useState<CategoryDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [error, setError] = useState("")
  const affectedGuides = deleteTarget
    ? guides.filter((guide) => guide.category === deleteTarget.id)
    : []

  function submit() {
    if (!editing) return
    const label = editing.label.trim()
    const description = editing.description.trim()
    if (!label || !description) return setError("Add a name and description.")
    if (
      categories.some(
        (category) =>
          category.id !== editing.id &&
          category.label.toLowerCase() === label.toLowerCase()
      )
    )
      return setError("A category with this name already exists.")

    let id = editing.id
    if (!id) {
      const base = slugify(label) || "category"
      id = base
      let suffix = 2
      while (categories.some((category) => category.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }
    saveCategory({ id, label, description, iconKey: editing.iconKey })
    showFeedback(editing.id ? "Category saved." : "Category created.")
    setEditing(null)
    setError("")
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Guide categories"
        description="Manage the work areas shown in the employee sidebar and guide browser."
        action={
          canCreateContent ? (
            <Button
              onClick={() => {
                setEditing({ ...blankCategory })
                setError("")
              }}
            >
              <Plus /> <T>New category</T>
            </Button>
          ) : undefined
        }
      />

      {categories.length ? (
        <div className="space-y-4">
          {categories.map((category, index) => {
            const guideCount = guides.filter(
              (guide) => guide.category === category.id
            ).length
            return (
              <Card key={category.id} size="sm" className="shadow-none">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                    <CategoryIcon
                      iconKey={category.iconKey}
                      className="size-5"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{category.label}</h2>
                      <span aria-hidden="true" className="text-border">
                        |
                      </span>
                      <Badge variant="secondary">
                        {guideCount}{" "}
                        <T>{guideCount === 1 ? "guide" : "guides"}</T>
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => moveCategory(category.id, -1)}
                      aria-label={t("Move {name} up", {
                        name: category.label,
                      })}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={index === categories.length - 1}
                      onClick={() => moveCategory(category.id, 1)}
                      aria-label={t("Move {name} down", {
                        name: category.label,
                      })}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing({ ...category })
                        setError("")
                      }}
                    >
                      <FilePenLine /> <T>Edit</T>
                    </Button>
                    {canCreateContent && (
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(category)}
                        aria-label={t("Delete {name}", {
                          name: category.label,
                        })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Tags}
          title="No guide categories"
          description="Create a work area before adding a guide."
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
        <DialogContent className="sm:max-w-xl">
          {editing && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  <T>{editing.id ? "Edit category" : "Create category"}</T>
                </DialogTitle>
                <DialogDescription>
                  <T>
                    Category changes appear immediately on the employee site.
                  </T>
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-4">
                <Field label="Name" id="category-name">
                  <Input
                    id="category-name"
                    value={editing.label}
                    onChange={(event) =>
                      setEditing({ ...editing, label: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Description" id="category-description">
                  <Textarea
                    id="category-description"
                    value={editing.description}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        description: event.target.value,
                      })
                    }
                    className="min-h-24 border border-input px-3"
                  />
                </Field>
                <fieldset>
                  <legend className="text-sm font-medium">
                    <T>Icon</T>
                  </legend>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {categoryIconOptions.map((option) => {
                      const selected = editing.iconKey === option.key
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() =>
                            setEditing({ ...editing, iconKey: option.key })
                          }
                          className={cn(
                            "flex min-h-20 flex-col items-center justify-center gap-2 border p-2 text-xs",
                            selected &&
                              "border-primary bg-primary/5 text-primary"
                          )}
                          aria-pressed={selected}
                        >
                          <CategoryIcon
                            iconKey={option.key}
                            className="size-5"
                          />
                          <T>{option.label}</T>
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    <T>{error}</T>
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  <T>Cancel</T>
                </Button>
                <Button type="submit">
                  <T>Save category</T>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget && affectedGuides.length)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <T>Reassign guides before deleting</T>
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.label} <T>is still used by</T>{" "}
              {affectedGuides.length}{" "}
              <T>{affectedGuides.length === 1 ? "guide" : "guides"}</T>
              <T>. Move them to another work area first.</T>
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-2">
            {affectedGuides.map((guide) => (
              <Link
                key={guide.id}
                href={`/manager/guides/${guide.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-auto w-full justify-between py-3 tracking-normal normal-case"
                )}
              >
                {guide.title}
                <FilePenLine />
              </Link>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              <T>Close</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget && !affectedGuides.length)}
        title={deleteTarget?.label ?? "category"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteCategory(deleteTarget.id)
            showFeedback("Category deleted.")
          }
        }}
      />
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
