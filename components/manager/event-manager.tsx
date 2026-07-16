"use client"

import { useMemo, useState } from "react"
import { CalendarDays, FilePenLine, Plus, Search, Trash2 } from "lucide-react"

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
  eventCategories,
  formatDate,
  formatTime,
  slugify,
  toLocalDateTimeValue,
  type CalendarEvent,
  type EventCategory,
} from "@/lib/operations"

type Status = "All" | "Published" | "Draft"

function newEvent(): CalendarEvent {
  const start = new Date()
  start.setDate(start.getDate() + 1)
  start.setHours(10, 0, 0, 0)
  const end = new Date(start)
  end.setHours(11, 0)
  return {
    id: "",
    title: "",
    description: "",
    category: "Reservation",
    start: toLocalDateTimeValue(start),
    end: toLocalDateTimeValue(end),
    location: "",
    owner: "",
    notes: "",
    attachments: [],
    guideIds: [],
    published: false,
  }
}

export function EventManager() {
  const { events, guides, saveEvent, deleteEvent, showFeedback } =
    useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [category, setCategory] = useState<EventCategory | "All">("All")
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [attachments, setAttachments] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
  const [error, setError] = useState("")
  const visible = useMemo(
    () =>
      events
        .filter(
          (event) =>
            `${event.title} ${event.description} ${event.location}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (status === "All" ||
              (status === "Published" ? event.published : !event.published)) &&
            (category === "All" || event.category === category)
        )
        .sort((a, b) => a.start.localeCompare(b.start)),
    [events, query, status, category]
  )

  function openEditor(event: CalendarEvent) {
    setEditing({
      ...event,
      attachments: [...event.attachments],
      guideIds: [...event.guideIds],
    })
    setAttachments(event.attachments.join(", "))
    setError("")
  }

  function submit() {
    if (!editing) return
    if (
      !editing.title.trim() ||
      !editing.description.trim() ||
      !editing.location.trim() ||
      !editing.owner.trim()
    )
      return setError(
        "Add a title, description, location, and responsible person."
      )
    if (!editing.start || !editing.end)
      return setError("Add a start and end date and time.")
    if (new Date(editing.end) <= new Date(editing.start))
      return setError("The end must be later than the start.")
    let id = editing.id || slugify(editing.title)
    if (!editing.id && events.some((event) => event.id === id))
      id = `${id}-${Date.now()}`
    saveEvent({
      ...editing,
      id,
      title: editing.title.trim(),
      description: editing.description.trim(),
      location: editing.location.trim(),
      owner: editing.owner.trim(),
      notes: editing.notes.trim(),
      attachments: attachments
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    })
    showFeedback(editing.id ? "Event saved." : "Event created.")
    setEditing(null)
  }

  return (
    <div className="space-y-8">
      <ManagerHeading
        title="Manage calendar events"
        description="Maintain shared operational dates and their related information."
        action={
          <Button onClick={() => openEditor(newEvent())}>
            <Plus /> New event
          </Button>
        }
      />
      <div className="grid gap-4 border bg-background p-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events…"
            aria-label="Search events"
            className="border border-input pr-3 pl-10"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as Status)}
          className="h-10 border bg-background px-3 text-sm"
          aria-label="Filter events by status"
        >
          <option>All</option>
          <option>Published</option>
          <option>Draft</option>
        </select>
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as EventCategory | "All")
          }
          className="h-10 border bg-background px-3 text-sm"
          aria-label="Filter events by type"
        >
          <option>All</option>
          {eventCategories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((event) => (
            <Card key={event.id} className="shadow-none">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <CalendarDays className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{event.title}</h3>
                    <Badge variant={event.published ? "secondary" : "outline"}>
                      {event.published ? "Published" : "Draft"}
                    </Badge>
                    <Badge variant="secondary">{event.category}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(event.start)}, {formatTime(event.start)} ·{" "}
                    {event.location}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      saveEvent({ ...event, published: !event.published })
                      showFeedback(
                        event.published
                          ? "Event unpublished."
                          : "Event published."
                      )
                    }}
                  >
                    {event.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditor(event)}
                  >
                    <FilePenLine /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(event)}
                    aria-label={`Delete ${event.title}`}
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
          icon={CalendarDays}
          title="No matching events"
          description="Clear the search or choose different filters."
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
                  {editing.id ? "Edit event" : "Create event"}
                </DialogTitle>
                <DialogDescription>
                  Published events appear immediately in Today, Calendar, and
                  search.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 grid gap-4 sm:grid-cols-2">
                <Field label="Title" id="event-title" wide>
                  <Input
                    id="event-title"
                    value={editing.title}
                    onChange={(event) =>
                      setEditing({ ...editing, title: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Description" id="event-description" wide>
                  <Textarea
                    id="event-description"
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
                <Field label="Event type" id="event-type">
                  <select
                    id="event-type"
                    value={editing.category}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        category: event.target.value as EventCategory,
                      })
                    }
                    className="h-10 w-full border bg-background px-3 text-sm"
                  >
                    {eventCategories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Location" id="event-location">
                  <Input
                    id="event-location"
                    value={editing.location}
                    onChange={(event) =>
                      setEditing({ ...editing, location: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Starts" id="event-start">
                  <Input
                    id="event-start"
                    type="datetime-local"
                    value={editing.start}
                    onChange={(event) =>
                      setEditing({ ...editing, start: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Ends" id="event-end">
                  <Input
                    id="event-end"
                    type="datetime-local"
                    value={editing.end}
                    onChange={(event) =>
                      setEditing({ ...editing, end: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Responsible person" id="event-owner">
                  <Input
                    id="event-owner"
                    value={editing.owner}
                    onChange={(event) =>
                      setEditing({ ...editing, owner: event.target.value })
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <Field
                  label="Attachments, separated by commas"
                  id="event-attachments"
                >
                  <Input
                    id="event-attachments"
                    value={attachments}
                    onChange={(event) => setAttachments(event.target.value)}
                    placeholder="Brief.pdf, Plan.pdf"
                    className="border border-input px-3"
                  />
                </Field>
                <Field label="Notes" id="event-notes" wide>
                  <Textarea
                    id="event-notes"
                    value={editing.notes}
                    onChange={(event) =>
                      setEditing({ ...editing, notes: event.target.value })
                    }
                    className="min-h-24 border border-input px-3"
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Related guides</Label>
                  <div className="grid gap-2 border p-4 sm:grid-cols-2">
                    {guides
                      .filter((guide) => guide.published)
                      .map((guide) => (
                        <label
                          key={guide.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <input
                            className="mt-1"
                            type="checkbox"
                            checked={editing.guideIds.includes(guide.id)}
                            onChange={(event) =>
                              setEditing({
                                ...editing,
                                guideIds: event.target.checked
                                  ? [...editing.guideIds, guide.id]
                                  : editing.guideIds.filter(
                                      (id) => id !== guide.id
                                    ),
                              })
                            }
                          />{" "}
                          {guide.title}
                        </label>
                      ))}
                  </div>
                </div>
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
                <Button type="submit">Save event</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title ?? "event"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteEvent(deleteTarget.id)
            showFeedback("Event deleted.")
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
