import { T } from "@/components/providers/i18n-provider"

import { CircleAlert, TriangleAlert } from "lucide-react"

import type { CalendarImportIssue } from "@/lib/icalendar"

export function CalendarImportIssues({
  issues,
}: {
  issues: CalendarImportIssue[]
}) {
  const errors = issues.filter((issue) => issue.severity === "error")
  const warnings = issues.filter((issue) => issue.severity === "warning")

  if (!errors.length && !warnings.length) return null

  return (
    <div className="space-y-3" aria-live="polite">
      {errors.length > 0 && (
        <IssueGroup title="Could not import" issues={errors} tone="error" />
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
}: {
  title: string
  issues: CalendarImportIssue[]
  tone: "error" | "warning"
}) {
  const Icon = tone === "error" ? CircleAlert : TriangleAlert

  return (
    <section
      role={tone === "error" ? "alert" : "status"}
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
          <li className="text-muted-foreground">
            +{issues.length - 5} <T>more</T>
          </li>
        )}
      </ul>
    </section>
  )
}
