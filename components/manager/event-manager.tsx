"use client"

import { useMemo, useState } from "react"
import {
  CalendarDays,
  FilePenLine,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react"

import { CalendarExportButton } from "@/components/calendar/calendar-export-button"
import {
  CalendarImportIssues,
  calendarImportErrorPreview,
} from "@/components/manager/calendar-import-issues"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  mergeImportedEvent,
  parseICalendar,
  type CalendarImportIssue,
  type CalendarImportResult,
} from "@/lib/icalendar"
import {
  eventCategories,
  formatDate,
  formatEventTime,
  slugify,
  toLocalDateTimeValue,
  type CalendarEvent,
  type EventCategory,
} from "@/lib/operations"

type Status = "All" | "Published" | "Draft"

function newEvent(location = ""): CalendarEvent {
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
    allDay: false,
    location,
    employees: [],
    notes: "",
    attachments: [],
    guideIds: [],
    published: false,
  }
}

export function EventManager() {
  const {
    events,
    employees,
    guides,
    hub,
    canCreateContent,
    saveEvent,
    deleteEvent,
    uploadAttachment,
    deleteAttachment,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [category, setCategory] = useState<EventCategory | "All">("All")
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
  const [error, setError] = useState("")
  const [importOpen, setImportOpen] = useState(false)
  const [importResult, setImportResult] = useState<CalendarImportResult | null>(
    null
  )
  const [importFileName, setImportFileName] = useState("")
  const [importError, setImportError] = useState("")
  const [importing, setImporting] = useState(false)
  const [publishImported, setPublishImported] = useState(false)
  const [importSaveIssues, setImportSaveIssues] = useState<
    CalendarImportIssue[]
  >([])
  const [importOutcome, setImportOutcome] = useState("")
  const [importProgress, setImportProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
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
      employees: [...event.employees],
      guideIds: [...event.guideIds],
    })
    setPendingFiles([])
    setError("")
  }

  async function submit() {
    if (!editing) return
    if (
      !editing.title.trim() ||
      !editing.description.trim() ||
      !editing.location.trim()
    )
      return setError("Add a title, description, and location.")
    if (!editing.start || !editing.end)
      return setError("Add a start and end date and time.")
    if (!eventEndsAfterStart(editing))
      return setError("The end must be later than the start.")
    let id = editing.id || slugify(editing.title)
    if (!editing.id && events.some((event) => event.id === id))
      id = `${id}-${Date.now()}`
    setSaving(true)
    try {
      const eventSlug = await saveEvent({
        ...editing,
        id,
        title: editing.title.trim(),
        description: editing.description.trim(),
        location: editing.location.trim(),
        notes: editing.notes.trim(),
      })
      for (const file of pendingFiles) await uploadAttachment(eventSlug, file)
      showFeedback(editing.id ? "Event saved." : "Event created.")
      setEditing(null)
      setPendingFiles([])
    } finally {
      setSaving(false)
    }
  }

  function resetImport() {
    setImportResult(null)
    setImportFileName("")
    setImportError("")
    setPublishImported(false)
    setImportSaveIssues([])
    setImportOutcome("")
    setImportProgress(null)
  }

  async function readCalendarFile(file?: File) {
    resetImport()
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setImportError("Choose a calendar file smaller than 5 MB.")
      return
    }
    if (
      !file.name.toLowerCase().endsWith(".ics") &&
      file.type !== "text/calendar"
    ) {
      setImportError("Choose an iCalendar file ending in .ics.")
      return
    }
    try {
      const result = parseICalendar(await file.text(), {
        timeZone: hub?.timeZone ?? "UTC",
      })
      setImportFileName(file.name)
      setImportResult(result)
    } catch {
      setImportError("This calendar file could not be read.")
    }
  }

  async function importEvents() {
    if (!importResult?.events.length) return
    const pendingResult = importResult
    const total = pendingResult.events.length
    const failedEvents: CalendarEvent[] = []
    const saveIssues: CalendarImportIssue[] = []
    let importedCount = 0
    setImporting(true)
    setImportSaveIssues([])
    setImportOutcome("")
    setImportProgress({ completed: 0, total })
    try {
      const existingById = new Map(events.map((event) => [event.id, event]))
      for (const event of pendingResult.events) {
        const existing = existingById.get(event.id)
        try {
          await saveEvent(mergeImportedEvent(event, existing, publishImported))
          importedCount += 1
        } catch (error) {
          failedEvents.push(event)
          saveIssues.push({
            severity: "error",
            message: importFailureMessage(event, error),
          })
        } finally {
          setImportProgress((current) =>
            current ? { ...current, completed: current.completed + 1 } : current
          )
        }
      }
      const fileErrors = pendingResult.issues.filter(
        (issue) => issue.severity === "error"
      ).length
      if (saveIssues.length || fileErrors) {
        setImportSaveIssues(saveIssues)
        setImportResult({ ...pendingResult, events: failedEvents })
        setImportOutcome(
          `${importedCount} ${
            importedCount === 1 ? "event was" : "events were"
          } imported successfully. ${
            saveIssues.length + fileErrors
          } need attention.`
        )
        showFeedback(
          `${importedCount} imported; ${
            saveIssues.length + fileErrors
          } need attention.`
        )
      } else {
        showFeedback(
          `${importedCount} ${
            importedCount === 1 ? "event" : "events"
          } imported.`
        )
        setImportOpen(false)
        resetImport()
      }
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Manage calendar events"
        description="Maintain shared operational dates, import events from other calendars, or export published events as iCalendar."
        action={
          <div className="flex flex-wrap gap-2">
            <CalendarExportButton
              events={events.filter((event) => event.published)}
              calendarName={`${hub?.name ?? "Workplace"} calendar`}
              timeZone={hub?.timeZone ?? "UTC"}
            />
            {canCreateContent && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload /> Import .ics
                </Button>
                <Button
                  size="sm"
                  onClick={() => openEditor(newEvent(hub?.address ?? ""))}
                >
                  <Plus /> New event
                </Button>
              </>
            )}
          </div>
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
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label="Filter events by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as EventCategory | "All")}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label="Filter events by type"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All</SelectItem>
            {eventCategories.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((event) => (
            <Card key={event.id} size="sm" className="shadow-none">
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
                    {formatDate(event.start)}, {formatEventTime(event)} ·{" "}
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
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(event)}
                      aria-label={`Delete ${event.title}`}
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
                  <Select
                    value={editing.category}
                    onValueChange={(value) =>
                      setEditing({
                        ...editing,
                        category: value as EventCategory,
                      })
                    }
                  >
                    <SelectTrigger
                      id="event-type"
                      className="w-full border border-input bg-background px-3"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {eventCategories.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={editing.allDay}
                    onChange={(event) =>
                      setEditing(
                        toggleAllDayEvent(editing, event.target.checked)
                      )
                    }
                  />
                  All-day event
                </label>
                <Field
                  label={editing.allDay ? "Start date" : "Starts"}
                  id="event-start"
                >
                  <Input
                    id="event-start"
                    type={editing.allDay ? "date" : "datetime-local"}
                    value={
                      editing.allDay
                        ? editing.start.slice(0, 10)
                        : editing.start
                    }
                    onChange={(event) => {
                      const value = event.target.value
                      setEditing(
                        editing.allDay
                          ? updateAllDayStart(editing, value)
                          : clearEventInstants({
                              ...editing,
                              start: value,
                            })
                      )
                    }}
                    className="border border-input px-3"
                  />
                </Field>
                <Field
                  label={editing.allDay ? "Last day" : "Ends"}
                  id="event-end"
                >
                  <Input
                    id="event-end"
                    type={editing.allDay ? "date" : "datetime-local"}
                    min={
                      editing.allDay ? editing.start.slice(0, 10) : undefined
                    }
                    value={
                      editing.allDay
                        ? addCalendarDays(editing.end.slice(0, 10), -1)
                        : editing.end
                    }
                    onChange={(event) => {
                      const value = event.target.value
                      setEditing(
                        editing.allDay
                          ? {
                              ...editing,
                              end: `${addCalendarDays(value, 1)}T00:00`,
                            }
                          : clearEventInstants({
                              ...editing,
                              end: value,
                            })
                      )
                    }}
                    className="border border-input px-3"
                  />
                </Field>
                {editing.allDay && (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    All-day events remain all day when imported and exported.
                    The last day is inclusive.
                  </p>
                )}
                <Field label="Add attachments" id="event-attachments">
                  <Input
                    id="event-attachments"
                    type="file"
                    multiple
                    onChange={(event) =>
                      setPendingFiles(Array.from(event.target.files ?? []))
                    }
                    className="border border-input px-3"
                  />
                </Field>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Employees</Label>
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Select employees"
                  >
                    {employees
                      .filter(
                        (employee) =>
                          employee.status !== "deactivated" ||
                          editing.employees.some(
                            (selected) => selected.id === employee.id
                          )
                      )
                      .map((employee) => {
                        const selected = editing.employees.some(
                          (item) => item.id === employee.id
                        )
                        return (
                          <Button
                            key={employee.id}
                            type="button"
                            size="xs"
                            variant={selected ? "default" : "outline"}
                            className={selected ? undefined : "bg-background"}
                            aria-pressed={selected}
                            onClick={() =>
                              setEditing({
                                ...editing,
                                employees: selected
                                  ? editing.employees.filter(
                                      (item) => item.id !== employee.id
                                    )
                                  : [
                                      ...editing.employees,
                                      {
                                        id: employee.id,
                                        displayName: employee.displayName,
                                      },
                                    ],
                              })
                            }
                          >
                            {employee.displayName}
                          </Button>
                        )
                      })}
                    {!employees.length && (
                      <p className="text-sm text-muted-foreground">
                        Create employee profiles in Employees, or save this
                        event with no employees.
                      </p>
                    )}
                  </div>
                </div>
                {(editing.attachments.length > 0 ||
                  pendingFiles.length > 0) && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Attachments</Label>
                    <ul className="space-y-2 border p-3 text-sm">
                      {editing.attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <Paperclip className="size-4 shrink-0" />
                            <span className="truncate">{attachment.name}</span>
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${attachment.name}`}
                            onClick={async () => {
                              await deleteAttachment(attachment)
                              setEditing({
                                ...editing,
                                attachments: editing.attachments.filter(
                                  (item) => item.id !== attachment.id
                                ),
                              })
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      ))}
                      {pendingFiles.map((file) => (
                        <li
                          key={`${file.name}-${file.size}`}
                          className="flex items-center gap-2 text-muted-foreground"
                        >
                          <Paperclip className="size-4" /> {file.name}{" "}
                          <span>(uploads on save)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Select related guides"
                  >
                    {guides
                      .filter((guide) => guide.published)
                      .map((guide) => {
                        const selected = editing.guideIds.includes(guide.id)
                        return (
                          <Button
                            key={guide.id}
                            type="button"
                            size="xs"
                            variant={selected ? "default" : "outline"}
                            className={selected ? undefined : "bg-background"}
                            aria-pressed={selected}
                            onClick={() =>
                              setEditing({
                                ...editing,
                                guideIds: selected
                                  ? editing.guideIds.filter(
                                      (id) => id !== guide.id
                                    )
                                  : [...editing.guideIds, guide.id],
                              })
                            }
                          >
                            {guide.title}
                          </Button>
                        )
                      })}
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
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save event"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          if (importing) return
          setImportOpen(open)
          if (!open) resetImport()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import calendar events</DialogTitle>
            <DialogDescription>
              Upload an .ics file exported from Google Calendar, Apple Calendar,
              Outlook, or another iCalendar app. Re-importing updates calendar
              details while preserving manager-owned categories, publishing,
              assignments, notes, attachments, and guide links.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-import">iCalendar file</Label>
              <Input
                id="calendar-import"
                type="file"
                accept=".ics,text/calendar"
                disabled={importing}
                onChange={(event) =>
                  void readCalendarFile(event.target.files?.[0])
                }
                className="border border-input px-3"
              />
            </div>
            {importResult?.events.length ? (
              <div className="border bg-muted/30 p-4">
                <p className="font-semibold">
                  {importResult.events.length}{" "}
                  {importResult.events.length === 1 ? "event" : "events"} ready
                  to import
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {importFileName}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {importResult.events.slice(0, 5).map((event) => (
                    <li key={event.id}>
                      {formatDate(event.start)} · {event.title}
                      {event.allDay ? " · All day" : ""}
                    </li>
                  ))}
                  {importResult.events.length > 5 && (
                    <li className="text-muted-foreground">
                      +{importResult.events.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            ) : null}
            {!importResult && !importError && (
              <CalendarImportIssues
                issues={calendarImportErrorPreview}
                preview
              />
            )}
            {importResult && (
              <CalendarImportIssues
                issues={[...importResult.issues, ...importSaveIssues]}
              />
            )}
            {importOutcome && (
              <p
                role="status"
                className="border border-success/30 bg-success/10 p-3 text-sm font-medium"
              >
                {importOutcome}
              </p>
            )}
            {importResult?.events.length ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishImported}
                  onChange={(event) => setPublishImported(event.target.checked)}
                />
                Publish imported events immediately
              </label>
            ) : null}
            {importError && (
              <p role="alert" className="text-sm text-destructive">
                {importError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={importing}
              onClick={() => {
                setImportOpen(false)
                resetImport()
              }}
            >
              {importOutcome && !importResult?.events.length ? "Done" : "Cancel"}
            </Button>
            <Button
              type="button"
              disabled={!importResult?.events.length || importing}
              onClick={() => void importEvents()}
            >
              {importing && importProgress
                ? `Importing ${importProgress.completed} of ${importProgress.total}…`
                : `Import ${importResult?.events.length ?? 0} ${
                    importResult?.events.length === 1 ? "event" : "events"
                  }`}
            </Button>
          </DialogFooter>
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

function eventEndsAfterStart(event: CalendarEvent) {
  if (event.startUtc && event.endUtc) {
    const start = new Date(event.startUtc).getTime()
    const end = new Date(event.endUtc).getTime()
    if (!Number.isNaN(start) && !Number.isNaN(end)) return end > start
  }
  return event.end > event.start
}

function clearEventInstants(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    startUtc: undefined,
    endUtc: undefined,
  }
}

function toggleAllDayEvent(
  event: CalendarEvent,
  allDay: boolean
): CalendarEvent {
  const startDate = event.start.slice(0, 10)
  const endDate = event.end.slice(0, 10)

  if (allDay) {
    const lastDay = endDate >= startDate ? endDate : startDate
    return {
      ...clearEventInstants(event),
      allDay: true,
      start: `${startDate}T00:00`,
      end: `${addCalendarDays(lastDay, 1)}T00:00`,
    }
  }

  const lastDay = addCalendarDays(endDate, -1)
  return {
    ...clearEventInstants(event),
    allDay: false,
    start: `${startDate}T09:00`,
    end: lastDay > startDate ? `${lastDay}T17:00` : `${startDate}T10:00`,
  }
}

function updateAllDayStart(event: CalendarEvent, value: string): CalendarEvent {
  if (!value) return { ...clearEventInstants(event), start: "" }
  const minimumEnd = `${addCalendarDays(value, 1)}T00:00`
  return {
    ...clearEventInstants(event),
    start: `${value}T00:00`,
    end: event.end > `${value}T00:00` ? event.end : minimumEnd,
  }
}

function addCalendarDays(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ""
  const [year, month, day] = value.split("-").map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

function importFailureMessage(event: CalendarEvent, error: unknown) {
  const fallback = "The event could not be saved. Try again."
  if (!(error instanceof Error)) return `“${event.title}” failed: ${fallback}`
  const match = error.message.match(/(?:Uncaught )?Error:\s*([^\n]+)/)
  const message = (match?.[1] ?? error.message).trim() || fallback
  return `“${event.title}” failed: ${message}`
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
