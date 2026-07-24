"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, FilePenLine, Plus, Search, Trash2 } from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  const {
    categories,
    guides,
    canCreateContent,
    saveGuide,
    deleteGuide,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [categoryId, setCategoryId] = useState("All")
  const [deleteTarget, setDeleteTarget] = useState<Guide | null>(null)
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
        title="Manage guides"
        description="Create, edit, publish, and remove practical instructions."
        action={
          canCreateContent ? (
            categories.length ? (
              <Link href="/manager/guides/new" className={buttonVariants()}>
                <Plus /> New guide
              </Link>
            ) : (
              <Link
                href="/manager/categories"
                className={buttonVariants({ variant: "outline" })}
              >
                <Plus /> Create a category first
              </Link>
            )
          ) : undefined
        }
      />
      <div className="grid gap-4 border bg-background p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-3 lg:col-span-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guides…"
            aria-label="Search guides"
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={categoryId}
          onValueChange={(value) => value && setCategoryId(value)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label="Filter guides by work area"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All work areas</SelectItem>
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
            aria-label="Filter guides by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((guide) => (
            <Card key={guide.id} size="sm" className="shadow-none">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{guide.title}</h3>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant={guide.published ? "secondary" : "outline"}>
                      {guide.published ? "Published" : "Draft"}
                    </Badge>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant="outline">
                      {categories.find((item) => item.id === guide.category)
                        ?.label ?? "Unknown work area"}
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
                  <Link
                    href={`/manager/guides/${guide.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <FilePenLine /> Edit
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(guide)}
                      aria-label={`Delete ${guide.title}`}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No matching guides"
          description="Clear the search or choose another filter."
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
            showFeedback("Guide deleted.")
          }
        }}
      />
    </div>
  )
}
