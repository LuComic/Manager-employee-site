"use client"

import { useMemo, useState } from "react"
import {
  FilePenLine,
  Megaphone,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react"

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
import {
  getAnnouncementState,
  slugify,
  toDateKey,
  type Announcement,
  type AnnouncementPriority,
} from "@/lib/operations"

type Status = "All" | "Active" | "Upcoming" | "Expired" | "Draft"

function newAnnouncement(): Announcement {
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  return {
    id: "",
    title: "",
    message: "",
    publishedAt: toDateKey(new Date()),
    expiresAt: toDateKey(expires),
    priority: "Normal",
    pinned: false,
    published: false,
  }
}

export function AnnouncementManager() {
  const {
    announcements,
    guides,
    events,
    saveAnnouncement,
    deleteAnnouncement,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [error, setError] = useState("")
  const visible = useMemo(
    () =>
      announcements
        .filter(
          (announcement) =>
            `${announcement.title} ${announcement.message}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (status === "All" || getAnnouncementState(announcement) === status)
        )
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.publishedAt.localeCompare(a.publishedAt)
        ),
    [announcements, query, status]
  )

  function submit() {
    if (!editing) return
    if (!editing.title.trim() || !editing.message.trim())
      return setError("Add a title and message.")
    if (!editing.publishedAt || !editing.expiresAt)
      return setError("Add publish and expiration dates.")
    if (editing.expiresAt < editing.publishedAt)
      return setError("The expiration date cannot be before the publish date.")
    let id = editing.id || slugify(editing.title)
    if (
      !editing.id &&
      announcements.some((announcement) => announcement.id === id)
    )
      id = `${id}-${Date.now()}`
    saveAnnouncement({
      ...editing,
      id,
      title: editing.title.trim(),
      message: editing.message.trim(),
      guideId: editing.guideId || undefined,
      eventId: editing.eventId || undefined,
    })
    showFeedback(editing.id ? "Announcement saved." : "Announcement created.")
    setEditing(null)
  }

  return (
    <div className="space-y-8">
      <ManagerHeading
        title="Manage announcements"
        description="Maintain temporary notices, dates, priority, and pinned state."
        action={
          <Button
            onClick={() => {
              setEditing(newAnnouncement())
              setError("")
            }}
          >
            <Plus /> New announcement
          </Button>
        }
      />
      <div className="flex flex-col gap-4 border bg-background p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search announcements…"
            aria-label="Search announcements"
            className="border border-input pr-3 pl-10"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as Status)}
          className="h-10 border bg-background px-3 text-sm"
          aria-label="Filter announcements by status"
        >
          <option>All</option>
          <option>Active</option>
          <option>Upcoming</option>
          <option>Expired</option>
          <option>Draft</option>
        </select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((announcement) => {
            const state = getAnnouncementState(announcement)
            return (
              <Card key={announcement.id} className="shadow-none">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                    <Megaphone className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <Badge
                        variant={state === "Draft" ? "outline" : "secondary"}
                      >
                        {state}
                      </Badge>
                      <Badge
                        variant={
                          announcement.priority === "Urgent"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {announcement.priority}
                      </Badge>
                      {announcement.pinned && (
                        <Badge variant="secondary">
                          <Pin /> Pinned
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {announcement.message}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        saveAnnouncement({
                          ...announcement,
                          pinned: !announcement.pinned,
                        })
                        showFeedback(
                          announcement.pinned
                            ? "Announcement unpinned."
                            : "Announcement pinned."
                        )
                      }}
                    >
                      {announcement.pinned ? (
                        <>
                          <PinOff /> Unpin
                        </>
                      ) : (
                        <>
                          <Pin /> Pin
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        saveAnnouncement({
                          ...announcement,
                          published: !announcement.published,
                        })
                        showFeedback(
                          announcement.published
                            ? "Announcement unpublished."
                            : "Announcement published."
                        )
                      }}
                    >
                      {announcement.published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing({ ...announcement })
                        setError("")
                      }}
                    >
                      <FilePenLine /> Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(announcement)}
                      aria-label={`Delete ${announcement.title}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="No matching announcements"
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
                  {editing.id ? "Edit announcement" : "Create announcement"}
                </DialogTitle>
                <DialogDescription>
                  Active published announcements appear immediately on Today,
                  Announcements, and search.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 grid gap-4 sm:grid-cols-2">
                <Field label="Title" id="announcement-title" wide>
                  <Input
                    id="announcement-title"
                    value={editing.title}
                    onChange={(event) =>
                      setEditing({ ...editing, title: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Message" id="announcement-message" wide>
                  <Textarea
                    id="announcement-message"
                    value={editing.message}
                    onChange={(event) =>
                      setEditing({ ...editing, message: event.target.value })
                    }
                    className="min-h-28 border border-input px-3"
                  />
                </Field>
                <Field label="Publish date" id="announcement-start">
                  <Input
                    id="announcement-start"
                    type="date"
                    value={editing.publishedAt}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        publishedAt: event.target.value,
                      })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Expiration date" id="announcement-end">
                  <Input
                    id="announcement-end"
                    type="date"
                    value={editing.expiresAt}
                    onChange={(event) =>
                      setEditing({ ...editing, expiresAt: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Priority" id="announcement-priority">
                  <select
                    id="announcement-priority"
                    value={editing.priority}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        priority: event.target.value as AnnouncementPriority,
                      })
                    }
                    className="h-10 w-full border bg-background px-3 text-sm"
                  >
                    <option>Normal</option>
                    <option>Important</option>
                    <option>Urgent</option>
                  </select>
                </Field>
                <Field label="Related guide" id="announcement-guide">
                  <select
                    id="announcement-guide"
                    value={editing.guideId ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        guideId: event.target.value || undefined,
                      })
                    }
                    className="h-10 w-full border bg-background px-3 text-sm"
                  >
                    <option value="">No related guide</option>
                    {guides.map((guide) => (
                      <option key={guide.id} value={guide.id}>
                        {guide.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Related event" id="announcement-event" wide>
                  <select
                    id="announcement-event"
                    value={editing.eventId ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        eventId: event.target.value || undefined,
                      })
                    }
                    className="h-10 w-full border bg-background px-3 text-sm"
                  >
                    <option value="">No related event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
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
                    checked={editing.pinned}
                    onChange={(event) =>
                      setEditing({ ...editing, pinned: event.target.checked })
                    }
                  />{" "}
                  Pin announcement
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
                <Button type="submit">Save announcement</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? "announcement"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteAnnouncement(deleteTarget.id)
            showFeedback("Announcement deleted.")
          }
        }}
      />
    </div>
  )
}

function Field({
  label,
  id,
  wide,
  children,
}: {
  label: string
  id: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
