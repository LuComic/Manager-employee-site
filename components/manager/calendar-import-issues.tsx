import { CircleAlert, TriangleAlert } from "lucide-react"

import type { CalendarImportIssue } from "@/lib/icalendar"

export const calendarImportErrorPreview: CalendarImportIssue[] = [
  {
    severity: "error",
    message:
      "Preview: “Sample event” failed because its description is 612 characters; the maximum is 500.",
  },
]

export function CalendarImportIssues({
  issues,
  preview = false,
}: {
  issues: CalendarImportIssue[]
  preview?: boolean
}) {
  const errors = issues.filter((issue) => issue.severity === "error")
  const warnings = issues.filter((issue) => issue.severity === "warning")

  if (!errors.length && !warnings.length) return null

  return (
    <div
      className="space-y-3"
      aria-live={preview ? undefined : "polite"}
      aria-label={preview ? "Example calendar import error" : undefined}
    >
      {preview && (
        <p className="text-xs text-muted-foreground">
          Example error preview only — this does not block an import.
        </p>
      )}
      {errors.length > 0 && (
        <IssueGroup
          title={preview ? "Example failed event" : "Could not import"}
          issues={errors}
          tone="error"
          announce={!preview}
        />
      )}
      {warnings.length > 0 && (
        <IssueGroup
          title="Imported with adjustments"
          issues={warnings}
          tone="warning"
        />
      )}
    </div>
  )
}

function IssueGroup({
  title,
  issues,
  tone,
  announce = true,
}: {
  title: string
  issues: CalendarImportIssue[]
  tone: "error" | "warning"
  announce?: boolean
}) {
  const Icon = tone === "error" ? CircleAlert : TriangleAlert

  return (
    <section
      role={announce ? (tone === "error" ? "alert" : "status") : undefined}
      className={
        tone === "error"
          ? "border border-destructive/30 bg-destructive/5 p-3"
          : "border border-warning/40 bg-warning/10 p-3"
      }
    >
      <h3
        className={
          tone === "error"
            ? "flex items-center gap-2 text-sm font-semibold text-destructive"
            : "flex items-center gap-2 text-sm font-semibold text-warning"
        }
      >
        <Icon className="size-4 shrink-0" />
        {title} ({issues.length})
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
        {issues.slice(0, 5).map((issue, index) => (
          <li key={`${issue.message}-${index}`}>{issue.message}</li>
        ))}
        {issues.length > 5 && (
          <li className="text-muted-foreground">+{issues.length - 5} more</li>
        )}
      </ul>
    </section>
  )
}
