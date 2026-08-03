"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import {
  CalendarDays,
  ChevronDown,
  FilePenLine,
  Menu,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react"

import { CalendarExportButton } from "@/components/calendar/calendar-export-button"
import { EventCategoryLabel } from "@/components/calendar/event-category-label"
import { CalendarImportIssues } from "@/components/manager/calendar-import-issues"
import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { WorkersCanEditToggle } from "@/components/manager/workers-can-edit-toggle"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  formatEventDate,
  formatEventTime,
  type CalendarEvent,
} from "@/lib/operations"
import { eventCategoryLabel } from "@/lib/categories"
import { cn } from "@/lib/utils"
import type { AppMessageKey } from "@/i18n/messages"
import type { TranslationValues } from "next-intl"

type Status = "All" | "Published" | "Draft"
type LocalizedMessage = {
  key: AppMessageKey
  values?: TranslationValues
}

export function EventManager() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const {
    events,
    eventTypes,
    hub,
    canCreateContent,
    canCreateInSection,
    saveEvent,
    deleteEvent,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<Status>("All")
  const [category, setCategory] = useState<string>("All")
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importResult, setImportResult] = useState<CalendarImportResult | null>(
    null
  )
  const [importFileName, setImportFileName] = useState("")
  const [importError, setImportError] = useState<LocalizedMessage | null>(null)
  const [importing, setImporting] = useState(false)
  const [publishImported, setPublishImported] = useState(false)
  const [importSaveIssues, setImportSaveIssues] = useState<
    CalendarImportIssue[]
  >([])
  const [importOutcome, setImportOutcome] = useState<LocalizedMessage | null>(
    null
  )
  const [importProgress, setImportProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
  const canCreateEvents = canCreateInSection("events")
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
    setImportError(null)
    setPublishImported(false)
    setImportSaveIssues([])
    setImportOutcome(null)
    setImportProgress(null)
  }

  async function readCalendarFile(file?: File) {
    resetImport()
    if (!file) return
    if (file.size > MAX_ICALENDAR_FILE_SIZE_BYTES) {
      setImportError({ key: "calendarFileTooLarge" })
      return
    }
    if (
      !file.name.toLowerCase().endsWith(".ics") &&
      file.type !== "text/calendar"
    ) {
      setImportError({ key: "calendarChooseIcsFile" })
      return
    }
    try {
      const result = parseICalendar(await file.text(), {
        timeZone: hub?.timeZone ?? "UTC",
        uidNamespace: hub?.id ?? "unconfigured-workplace",
        defaultDescription: t("calendarImportedExternalDescription"),
        defaultLocation: t("calendarNoLocationSpecified"),
        cancelledEventTitle: t("calendarCancelledEvent"),
        eventTypes: eventTypes.map((eventType) => ({
          ...eventType,
          label: eventCategoryLabel(eventType.id, eventTypes),
        })),
      })
      setImportFileName(file.name)
      setImportResult(result)
    } catch {
      setImportError({ key: "calendarFileCouldNotBeRead" })
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
    setImportOutcome(null)
    setImportProgress({ completed: 0, total })
    try {
      const existingById = new Map(events.map((event) => [event.id, event]))
      for (const event of pendingResult.events) {
        const existing = existingById.get(event.id)
        try {
          await saveEvent(mergeImportedEvent(event, existing, publishImported))
          importedCount += 1
        } catch {
          failedEvents.push(event)
          saveIssues.push({
            severity: "error",
            key: "calendarEventSaveFailed",
            values: { title: event.title },
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
            key: "calendarCancellationNoMatch",
            values: { title: cancellation.title },
          })
          setImportProgress((current) =>
            current ? { ...current, completed: current.completed + 1 } : current
          )
          continue
        }
        try {
          await saveEvent({ ...existing, published: false })
          cancelledCount += 1
        } catch {
          failedCancellations.push(cancellation)
          saveIssues.push({
            severity: "error",
            key: "calendarCancellationApplyFailed",
            values: { title: cancellation.title },
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
      const attentionCount = saveErrors + fileErrors
      const outcome: LocalizedMessage = {
        key: "calendarImportOutcome",
        values: {
          importedCount,
          cancelledCount,
          skippedCancellationCount,
          attentionCount,
        },
      }
      if (needsReview) {
        setImportSaveIssues(saveIssues)
        setImportResult({
          ...pendingResult,
          events: failedEvents,
          cancellations: failedCancellations,
        })
        setImportOutcome(outcome)
        showFeedback(outcome.key, outcome.values)
      } else {
        showFeedback(outcome.key, outcome.values)
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
        title="manageCalendarEvents"
        description="maintainSharedOperationalDatesImportEventsOtherMessage"
        action={
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                <Menu /> <T>moreLowercase</T> <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <CalendarExportButton
                  events={events.filter((event) => event.published)}
                  calendarName={t("namedCalendar", {
                    name: hub?.name ?? t("workplace"),
                  })}
                  timeZone={hub?.timeZone ?? "UTC"}
                  uidNamespace={hub?.id ?? "unconfigured-workplace"}
                  appearance="menu-item"
                />
                {canCreateEvents && (
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <Upload /> <T>importIcs</T>
                  </DropdownMenuItem>
                )}
                <WorkersCanEditToggle section="events" appearance="menu-item" />
              </DropdownMenuContent>
            </DropdownMenu>
            {canCreateEvents && (
              <Link
                href="/manager/calendar/new"
                className={buttonVariants({ size: "sm" })}
              >
                <Plus data-icon="inline-start" /> <T>add</T>
              </Link>
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
            placeholder={t("searchEventsPlaceholder")}
            aria-label={t("searchEvents")}
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as Status)}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterEventsByStatus")}
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
        <Select
          value={category}
          onValueChange={(value) => {
            if (value) setCategory(value)
          }}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterEventsByType")}
          >
            <SelectValue>
              {category === "All" ? (
                t("all")
              ) : (
                <EventCategoryLabel
                  category={category}
                  eventTypes={eventTypes}
                  showSchedulePrivacy
                />
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">
              <T>all</T>
            </SelectItem>
            {eventTypes.map((eventType) => (
              <SelectItem key={eventType.id} value={eventType.id}>
                <EventCategoryLabel
                  category={eventType.id}
                  eventTypes={eventTypes}
                  showSchedulePrivacy
                />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((event) => (
            <ManagerListItem
              key={event.id}
              icon={<CalendarDays className="size-5" />}
              title={event.title}
              metadata={[
                <Badge
                  key="status"
                  variant={event.published ? "secondary" : "outline"}
                >
                  <T>{event.published ? "published" : "draft"}</T>
                </Badge>,
                <Badge key="category" variant="secondary">
                  <EventCategoryLabel
                    category={event.category}
                    eventTypes={eventTypes}
                    isPrivate={event.isPrivate}
                  />
                </Badge>,
              ]}
              description={
                <>
                  {formatEventDate(
                    event,
                    undefined,
                    hub?.timeZone,
                    languageTag
                  )}
                  ,{" "}
                  {formatEventTime(
                    event,
                    hub?.timeZone,
                    languageTag,
                    t("allDay")
                  )}{" "}
                  · {event.location}
                </>
              }
              actions={
                <>
                  {event.source !== "deputy" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        saveEvent({ ...event, published: !event.published })
                        showFeedback(
                          event.published
                            ? "eventUnpublished"
                            : "eventPublished"
                        )
                      }}
                    >
                      <T>{event.published ? "unpublish" : "publish"}</T>
                    </Button>
                  )}
                  <Link
                    href={`/manager/calendar/${event.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <FilePenLine data-icon="inline-start" /> <T>edit</T>
                  </Link>
                  {canCreateContent && event.source !== "deputy" && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(event)}
                      aria-label={t("deleteName", { name: event.title })}
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
          icon={CalendarDays}
          title="noMatchingEvents"
          description="clearSearchChooseDifferentFilters"
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
              <T>importCalendarEvents</T>
            </DialogTitle>
            <DialogDescription>
              <T>uploadIcsFileExportedGoogleCalendarAppleMessage</T>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-semibold">
                <T>smallProjectImportLimits</T>
              </p>
              <p className="mt-1 text-muted-foreground">
                <T>filesUp1mbFirst</T> {MAX_IMPORTED_EVENTS}{" "}
                <T>calendarProcessingAndNotifications</T>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calendar-import">
                <T>iCalendarFileLowercase</T>
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
                  {importReadyCount} <T>calendarLowercase</T>{" "}
                  <T>
                    {importReadyCount === 1
                      ? "changeLowercase"
                      : "changesLowercase"}
                  </T>{" "}
                  <T>readyLowercase</T>
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
                      {event.allDay && (
                        <>
                          {" "}
                          <T>allDayListSuffix</T>
                        </>
                      )}
                    </li>
                  ))}
                  {(importResult?.cancellations.length ?? 0) > 0 && (
                    <li className="text-warning">
                      {importResult?.cancellations.length}{" "}
                      <T>externalLowercase</T>{" "}
                      <T>
                        {importResult?.cancellations.length === 1
                          ? "cancellationLowercase"
                          : "cancellationsLowercase"}
                      </T>{" "}
                      <T>willUnpublishMatchingLocalEventsLowercase</T>
                    </li>
                  )}
                  {(importResult?.events.length ?? 0) > 5 && (
                    <li className="text-muted-foreground">
                      +{(importResult?.events.length ?? 0) - 5}{" "}
                      <T>moreLowercase</T>
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
                {t(importOutcome.key, importOutcome.values)}
              </p>
            )}
            {importResult?.events.length ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishImported}
                  onChange={(event) => setPublishImported(event.target.checked)}
                />
                <T>publishImportedEventsImmediately</T>
              </label>
            ) : null}
            {importError && (
              <p role="alert" className="text-sm text-destructive">
                {t(importError.key, importError.values)}
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
              <T>{importOutcome && !importReadyCount ? "done" : "cancel"}</T>
            </Button>
            <Button
              type="button"
              disabled={!importReadyCount || importing}
              onClick={() => void importEvents()}
            >
              {importing && importProgress
                ? t("calendarImportProgress", importProgress)
                : t("calendarApplyChanges", { count: importReadyCount })}
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
            showFeedback("eventDeleted")
          }
        }}
      />
    </div>
  )
}
