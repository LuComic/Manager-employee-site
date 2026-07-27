"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import {
  CalendarDays,
  FilePenLine,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react"

import { CalendarExportButton } from "@/components/calendar/calendar-export-button"
import { CalendarImportIssues } from "@/components/manager/calendar-import-issues"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MAX_ICALENDAR_FILE_SIZE_BYTES,
  MAX_IMPORTED_EVENTS,
  mergeImportedEvent,
  parseICalendar,
  type CalendarCancellation,
  type CalendarImportIssue,
  type CalendarImportResult,
} from "@/lib/icalendar"
import {
  eventCategories,
  formatEventDate,
  formatEventTime,
  type CalendarEvent,
  type EventCategory,
} from "@/lib/operations"
import { cn } from "@/lib/utils"

type Status = "All" | "Published" | "Draft"

export function EventManager() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const {
    events,
    hub,
    canCreateContent,
    saveEvent,
    deleteEvent,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [category, setCategory] = useState<EventCategory | "All">("All")
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
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
  const importReadyCount =
    (importResult?.events.length ?? 0) +
    (importResult?.cancellations.length ?? 0)
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
    if (file.size > MAX_ICALENDAR_FILE_SIZE_BYTES) {
      setImportError("Choose a calendar file no larger than 1 MB.")
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
    if (
      !importResult ||
      (!importResult.events.length && !importResult.cancellations.length)
    )
      return
    const pendingResult = importResult
    const total =
      pendingResult.events.length + pendingResult.cancellations.length
    const failedEvents: CalendarEvent[] = []
    const failedCancellations: CalendarCancellation[] = []
    const saveIssues: CalendarImportIssue[] = []
    let importedCount = 0
    let cancelledCount = 0
    let skippedCancellationCount = 0
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
      for (const cancellation of pendingResult.cancellations) {
        const existing = existingById.get(cancellation.id)
        if (!existing) {
          skippedCancellationCount += 1
          saveIssues.push({
            severity: "warning",
            message: `“${cancellation.title}” was cancelled externally, but no matching local event was found.`,
          })
          setImportProgress((current) =>
            current ? { ...current, completed: current.completed + 1 } : current
          )
          continue
        }
        try {
          await saveEvent({ ...existing, published: false })
          cancelledCount += 1
        } catch (error) {
          failedCancellations.push(cancellation)
          saveIssues.push({
            severity: "error",
            message: importCancellationFailureMessage(cancellation, error),
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
      const saveErrors = saveIssues.filter(
        (issue) => issue.severity === "error"
      ).length
      const needsReview = saveIssues.length > 0 || fileErrors > 0
      const outcome = [
        `${importedCount} ${
          importedCount === 1 ? "event was" : "events were"
        } imported.`,
        cancelledCount
          ? `${cancelledCount} ${
              cancelledCount === 1 ? "cancellation was" : "cancellations were"
            } applied.`
          : "",
        skippedCancellationCount
          ? `${skippedCancellationCount} unmatched ${
              skippedCancellationCount === 1
                ? "cancellation was"
                : "cancellations were"
            } skipped.`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
      if (needsReview) {
        setImportSaveIssues(saveIssues)
        setImportResult({
          ...pendingResult,
          events: failedEvents,
          cancellations: failedCancellations,
        })
        setImportOutcome(outcome)
        const attentionCount = saveErrors + fileErrors
        showFeedback(
          attentionCount > 0
            ? `${outcome} ${attentionCount} need attention.`
            : outcome
        )
      } else {
        showFeedback(outcome)
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
              calendarName={t("{name} calendar", {
                name: hub?.name ?? t("Workplace"),
              })}
              timeZone={hub?.timeZone ?? "UTC"}
            />
            {canCreateContent && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload /> <T>Import .ics</T>
                </Button>
                <Link
                  href="/manager/calendar/new"
                  className={buttonVariants({ size: "sm" })}
                >
                  <Plus /> <T>New event</T>
                </Link>
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
            aria-label={t("Filter events by status")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>All</T>
            </SelectItem>
            <SelectItem value="Published">
              <T>Published</T>
            </SelectItem>
            <SelectItem value="Draft">
              <T>Draft</T>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as EventCategory | "All")}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("Filter events by type")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>All</T>
            </SelectItem>
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
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant={event.published ? "secondary" : "outline"}>
                      <T>{event.published ? "Published" : "Draft"}</T>
                    </Badge>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant="secondary">{event.category}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatEventDate(
                      event,
                      undefined,
                      hub?.timeZone,
                      languageTag
                    )}
                    ,{" "}
                    <T>{formatEventTime(event, hub?.timeZone, languageTag)}</T>{" "}
                    · {event.location}
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
                    <T>{event.published ? "Unpublish" : "Publish"}</T>
                  </Button>
                  <Link
                    href={`/manager/calendar/${event.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <FilePenLine /> <T>Edit</T>
                  </Link>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(event)}
                      aria-label={t("Delete {name}", { name: event.title })}
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
        open={importOpen}
        onOpenChange={(open) => {
          if (importing) return
          setImportOpen(open)
          if (!open) resetImport()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <T>Import calendar events</T>
            </DialogTitle>
            <DialogDescription>
              <T>
                Upload an .ics file exported from Google Calendar, Apple
                Calendar, Outlook, or another iCalendar app. Re-importing
                updates calendar details while preserving manager-owned
                categories, publishing, assignments, notes, attachments, and
                guide links.
              </T>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-semibold">
                <T>Small-project import limits</T>
              </p>
              <p className="mt-1 text-muted-foreground">
                <T>Files can be up to 1 MB and the first</T>{" "}
                {MAX_IMPORTED_EVENTS}{" "}
                <T>
                  calendar changes are processed. Publishing imported events may
                  add one employee notification per event.
                </T>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-import">
                <T>iCalendar file</T>
              </Label>
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
            {importReadyCount ? (
              <div className="border bg-muted/30 p-4">
                <p className="font-semibold">
                  {importReadyCount} <T>calendar</T>{" "}
                  <T>{importReadyCount === 1 ? "change" : "changes"}</T>{" "}
                  <T>ready</T>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {importFileName}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {importResult?.events.slice(0, 5).map((event) => (
                    <li key={event.id}>
                      {formatEventDate(
                        event,
                        undefined,
                        hub?.timeZone,
                        languageTag
                      )}{" "}
                      · {event.title}
                      <T>{event.allDay ? " · All day" : ""}</T>
                    </li>
                  ))}
                  {(importResult?.cancellations.length ?? 0) > 0 && (
                    <li className="text-warning">
                      {importResult?.cancellations.length} <T>external</T>{" "}
                      <T>
                        {importResult?.cancellations.length === 1
                          ? "cancellation"
                          : "cancellations"}
                      </T>{" "}
                      <T>will unpublish matching local events</T>
                    </li>
                  )}
                  {(importResult?.events.length ?? 0) > 5 && (
                    <li className="text-muted-foreground">
                      +{(importResult?.events.length ?? 0) - 5} <T>more</T>
                    </li>
                  )}
                </ul>
              </div>
            ) : null}
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
                <T>Publish imported events immediately</T>
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
              <T>{importOutcome && !importReadyCount ? "Done" : "Cancel"}</T>
            </Button>
            <Button
              type="button"
              disabled={!importReadyCount || importing}
              onClick={() => void importEvents()}
            >
              {importing && importProgress
                ? `Importing ${importProgress.completed} of ${importProgress.total}…`
                : `Apply ${importReadyCount} calendar ${
                    importReadyCount === 1 ? "change" : "changes"
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

function importFailureMessage(event: CalendarEvent, error: unknown) {
  const fallback = "The event could not be saved. Try again."
  if (!(error instanceof Error)) return `“${event.title}” failed: ${fallback}`
  const match = error.message.match(/(?:Uncaught )?Error:\s*([^\n]+)/)
  const message = (match?.[1] ?? error.message).trim() || fallback
  return `“${event.title}” failed: ${message}`
}

function importCancellationFailureMessage(
  cancellation: CalendarCancellation,
  error: unknown
) {
  const fallback = "The cancellation could not be applied. Try again."
  if (!(error instanceof Error))
    return `“${cancellation.title}” failed: ${fallback}`
  const match = error.message.match(/(?:Uncaught )?Error:\s*([^\n]+)/)
  const message = (match?.[1] ?? error.message).trim() || fallback
  return `“${cancellation.title}” failed: ${message}`
}
