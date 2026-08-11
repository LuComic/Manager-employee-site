"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { useState } from "react"
import { Link } from "@/i18n/navigation"
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  FilePenLine,
  Plus,
  Tags,
  Trash2,
} from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AppMessageKey } from "@/i18n/messages"
import { Textarea } from "@/components/ui/textarea"
import {
  categoryIconOptions,
  CategoryIcon,
  type CategoryIconKey,
} from "@/lib/category-icons"
import type { Category } from "@/lib/knowledge-base"
import {
  DEPUTY_SCHEDULES_EVENT_TYPE_ID,
  type CategoryKind,
} from "@/lib/categories"
import { slugify } from "@/lib/operations"
import { cn } from "@/lib/utils"

type CategoryDraft = {
  id: string
  label: string
  description: string
  iconKey: CategoryIconKey
  kind: CategoryKind
}

const blankCategory: CategoryDraft = {
  id: "",
  label: "",
  description: "",
  iconKey: "general",
  kind: "guide",
}

export function CategoryManager() {
  const t = useAppTranslations()
  const {
    categories,
    guides,
    events,
    canCreateContent,
    saveCategory,
    moveCategory,
    deleteCategory,
    showFeedback,
  } = useOperations()
  const [editing, setEditing] = useState<CategoryDraft | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const affectedGuides = deleteTarget
    ? guides.filter((guide) => guide.category === deleteTarget.id)
    : []
  const affectedEvents = deleteTarget
    ? events.filter((event) => event.category === deleteTarget.id)
    : []
  const affectedItems =
    deleteTarget?.kind === "event" ? affectedEvents : affectedGuides
  const eventTypeCount = categories.filter(
    (category) => category.kind === "event"
  ).length
  const orderedCategories = [
    ...categories.filter((category) => category.kind === "guide"),
    ...categories.filter((category) => category.kind === "event"),
  ]

  async function submit() {
    if (!editing) return
    const label = editing.label.trim()
    const description = editing.description.trim()
    if (!label || (editing.kind === "guide" && !description)) {
      return setError(
        editing.kind === "guide" ? "addANameAndDescription" : "addAName"
      )
    }
    if (
      categories.some(
        (category) =>
          category.id !== editing.id &&
          category.kind === editing.kind &&
          category.label.toLowerCase() === label.toLowerCase()
      )
    )
      return setError("categoryNameAlreadyExists")

    let id = editing.id
    if (!id) {
      const slug = slugify(label) || "category"
      const base = editing.kind === "event" ? `event-${slug}` : slug
      id = base
      let suffix = 2
      while (categories.some((category) => category.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }
    setPending(true)
    try {
      await saveCategory({
        id,
        label,
        description,
        iconKey: editing.iconKey,
        kind: editing.kind,
      })
      showFeedback(editing.id ? "categorySaved" : "categoryCreated")
      setEditing(null)
      setError("")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="categories"
        description="manageGuideCategoriesAndEventTypesMessage"
        action={
          canCreateContent ? (
            <Button
              onClick={() => {
                setEditing({ ...blankCategory })
                setError("")
              }}
            >
              <Plus /> <T>createCategory</T>
            </Button>
          ) : undefined
        }
      />

      {categories.length ? (
        <div className="space-y-4">
          {orderedCategories.map((category) => {
            const siblings = orderedCategories.filter(
              (item) => item.kind === category.kind
            )
            const siblingIndex = siblings.findIndex(
              (item) => item.id === category.id
            )
            const guideCount = guides.filter(
              (guide) => guide.category === category.id
            ).length
            const eventCount = events.filter(
              (event) => event.category === category.id
            ).length
            const displayLabel = category.label
            return (
              <ManagerListItem
                key={category.id}
                icon={
                  category.kind === "guide" ? (
                    <CategoryIcon
                      iconKey={category.iconKey}
                      className="size-5"
                    />
                  ) : (
                    <CalendarDays className="size-5" />
                  )
                }
                iconClassName={
                  category.id === DEPUTY_SCHEDULES_EVENT_TYPE_ID
                    ? "bg-muted text-muted-foreground"
                    : undefined
                }
                title={displayLabel}
                titleAs="h2"
                metadata={[
                  <Badge key="kind" variant="secondary">
                    <T>
                      {category.kind === "guide"
                        ? "guideCategory"
                        : "eventType"}
                    </T>
                  </Badge>,
                  <Badge key="count" variant="outline">
                    {category.kind === "guide" ? guideCount : eventCount}{" "}
                    <T>
                      {category.kind === "guide"
                        ? guideCount === 1
                          ? "guideLowercase"
                          : "guidesLowercase"
                        : eventCount === 1
                          ? "eventLowercase"
                          : "eventsLowercase"}
                    </T>
                  </Badge>,
                ]}
                description={category.description || undefined}
                actions={
                  <>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={siblingIndex === 0}
                      onClick={() => moveCategory(category, -1)}
                      aria-label={t("moveNameUp", {
                        name: displayLabel,
                      })}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={siblingIndex === siblings.length - 1}
                      onClick={() => moveCategory(category, 1)}
                      aria-label={t("moveNameDown", {
                        name: displayLabel,
                      })}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing({ ...category, label: displayLabel })
                        setError("")
                      }}
                    >
                      <FilePenLine /> <T>edit</T>
                    </Button>
                    {canCreateContent && (
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        disabled={
                          category.kind === "event" && eventTypeCount <= 1
                        }
                        onClick={() => setDeleteTarget(category)}
                        aria-label={t("deleteName", {
                          name: displayLabel,
                        })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </>
                }
              />
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Tags}
          title="noCategories"
          description="createGuideCategoryOrEventTypeMessage"
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
                  <T>{editing.id ? "editCategory" : "createCategory"}</T>
                </DialogTitle>
                <DialogDescription>
                  <T>categoryChangesAppearImmediatelyEmployeeSite</T>
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-4">
                {!editing.id && (
                  <Field label="categoryType" id="category-type">
                    <Select
                      value={editing.kind}
                      onValueChange={(value) => {
                        if (!value) return
                        setEditing({
                          ...editing,
                          kind: value as CategoryKind,
                          description:
                            value === "event" ? "" : editing.description,
                        })
                      }}
                    >
                      <SelectTrigger
                        id="category-type"
                        className="w-full border border-input bg-background px-3"
                      >
                        <SelectValue>
                          <T>
                            {editing.kind === "guide"
                              ? "guideCategory"
                              : "eventType"}
                          </T>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guide">
                          <T>guideCategory</T>
                        </SelectItem>
                        <SelectItem value="event">
                          <T>eventType</T>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label="name" id="category-name">
                  <Input
                    id="category-name"
                    value={editing.label}
                    onChange={(event) =>
                      setEditing({ ...editing, label: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                {editing.kind === "guide" && (
                  <Field label="description" id="category-description">
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
                )}
                {editing.kind === "guide" && (
                  <fieldset>
                    <legend className="text-sm font-medium">
                      <T>icon</T>
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
                )}
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
                  <T>cancel</T>
                </Button>
                <Button type="submit" disabled={pending}>
                  <T>{pending ? "saving" : "saveCategory"}</T>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget && affectedItems.length)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <T>
                {deleteTarget?.kind === "event"
                  ? "reassignEventsBeforeDeleting"
                  : "reassignGuidesBeforeDeleting"}
              </T>
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.label ?? ""} <T>isStillUsedByLowercase</T>{" "}
              {affectedItems.length}{" "}
              <T>
                {deleteTarget?.kind === "event"
                  ? affectedItems.length === 1
                    ? "eventLowercase"
                    : "eventsLowercase"
                  : affectedItems.length === 1
                    ? "guideLowercase"
                    : "guidesLowercase"}
              </T>
              <T>
                {deleteTarget?.kind === "event"
                  ? "moveEventsBeforeDeleteHelp"
                  : "moveGuidesBeforeDeleteHelp"}
              </T>
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 max-h-[min(20rem,40dvh)] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {affectedItems.map((item) => (
              <Link
                key={item.id}
                href={
                  deleteTarget?.kind === "event"
                    ? `/manager/calendar/${item.id}/edit`
                    : `/manager/guides/${item.id}/edit`
                }
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-auto w-full justify-between py-3 tracking-normal normal-case"
                )}
              >
                <span className="min-w-0 flex-1 text-left wrap-break-word">
                  {item.title}
                </span>
                <FilePenLine data-icon="inline-end" />
              </Link>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              <T>close</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget && !affectedItems.length)}
        title={deleteTarget?.label ?? "category"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            void deleteCategory(deleteTarget)
              .then(() => showFeedback("categoryDeleted"))
              .catch(() => undefined)
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
