"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { BookOpen, FilePenLine, Plus, Search, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerFilterPanel } from "@/components/manager/manager-filter-panel"
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
    guideCategories,
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
          canCreateContent ||
          (canCreateGuides && guideCategories.length > 0) ? (
            <div className="flex flex-wrap gap-2">
              <WorkersCanEditToggle section="guides" />
              {canCreateGuides &&
                (guideCategories.length ? (
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
      <ManagerFilterPanel className="grid sm:grid-cols-3">
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
            {guideCategories.map((category) => (
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
      </ManagerFilterPanel>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((guide) => (
            <ManagerListItem
              key={guide.id}
              icon={<BookOpen className="size-5" />}
              title={guide.title}
              summaryHref={
                guide.published
                  ? `/guides/${guide.id}`
                  : `/manager/guides/${guide.id}/edit`
              }
              metadata={[
                <Badge
                  key="status"
                  variant={guide.published ? "secondary" : "outline"}
                >
                  <T>{guide.published ? "published" : "draft"}</T>
                </Badge>,
                <Badge key="category" variant="outline">
                  {guideCategories.find((item) => item.id === guide.category)
                    ?.label ?? t("unknownWorkArea")}
                </Badge>,
              ]}
              description={guide.description}
              actionsClassName="grid w-full grid-flow-col auto-cols-fr sm:flex sm:w-auto"
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-full sm:min-h-9 sm:w-auto"
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
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "min-h-11 w-full sm:min-h-9 sm:w-auto"
                    )}
                  >
                    <FilePenLine data-icon="inline-start" /> <T>edit</T>
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      className="w-full sm:size-9"
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
