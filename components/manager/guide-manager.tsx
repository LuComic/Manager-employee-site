"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { BookOpen, FilePenLine, Plus, Search, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { WorkersCanEditToggle } from "@/components/manager/workers-can-edit-toggle"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Guide } from "@/lib/knowledge-base"
import { cn } from "@/lib/utils"

type Status = "All" | "Published" | "Draft"

export function GuideManager() {
  const t = useAppTranslations()
  const {
    categories,
    guides,
    canCreateContent,
    canCreateInSection,
    saveGuide,
    deleteGuide,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [categoryId, setCategoryId] = useState("All")
  const [deleteTarget, setDeleteTarget] = useState<Guide | null>(null)
  const canCreateGuides = canCreateInSection("guides")
  const visible = useMemo(
    () =>
      guides.filter((guide) => {
        const matchesQuery = `${guide.title} ${guide.description}`
          .toLowerCase()
          .includes(query.toLowerCase())
        const matchesStatus =
          status === "All" ||
          (status === "Published" ? guide.published : !guide.published)
        const matchesCategory =
          categoryId === "All" || guide.category === categoryId
        return matchesQuery && matchesStatus && matchesCategory
      }),
    [guides, query, status, categoryId]
  )

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="manageGuides"
        description="createEditPublishRemovePracticalInstructions"
        action={
          canCreateContent || (canCreateGuides && categories.length > 0) ? (
            <div className="flex flex-wrap gap-2">
              <WorkersCanEditToggle section="guides" />
              {canCreateGuides &&
                (categories.length ? (
                  <Link href="/manager/guides/new" className={buttonVariants()}>
                    <Plus data-icon="inline-start" /> <T>createGuide</T>
                  </Link>
                ) : canCreateContent ? (
                  <Link
                    href="/manager/categories"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    <Plus data-icon="inline-start" />{" "}
                    <T>createACategoryFirst</T>
                  </Link>
                ) : null)}
            </div>
          ) : undefined
        }
      />
      <div className="grid gap-4 border bg-background p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-3 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchGuidesPlaceholder")}
            aria-label={t("searchGuides")}
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={categoryId}
          onValueChange={(value) => value && setCategoryId(value)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterGuidesByWorkArea")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>allWorkAreas</T>
            </SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterGuidesByStatus")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>all</T>
            </SelectItem>
            <SelectItem value="Published">
              <T>published</T>
            </SelectItem>
            <SelectItem value="Draft">
              <T>draft</T>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((guide) => (
            <ManagerListItem
              key={guide.id}
              icon={<BookOpen className="size-5" />}
              title={guide.title}
              metadata={[
                <Badge
                  key="status"
                  variant={guide.published ? "secondary" : "outline"}
                >
                  <T>{guide.published ? "published" : "draft"}</T>
                </Badge>,
                <Badge key="category" variant="outline">
                  {categories.find((item) => item.id === guide.category)
                    ?.label ?? t("unknownWorkArea")}
                </Badge>,
              ]}
              description={guide.description}
              actions={
                <>
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
                        guide.published ? "guideUnpublished" : "guidePublished"
                      )
                    }}
                  >
                    <T>{guide.published ? "unpublish" : "publish"}</T>
                  </Button>
                  <Link
                    href={`/manager/guides/${guide.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <FilePenLine data-icon="inline-start" /> <T>edit</T>
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(guide)}
                      aria-label={t("deleteName", { name: guide.title })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="noMatchingGuides"
          description="clearSearchChooseFilter"
        />
      )}
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? "guide"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteGuide(deleteTarget.id)
            showFeedback("guideDeleted")
          }
        }}
      />
    </div>
  )
}
