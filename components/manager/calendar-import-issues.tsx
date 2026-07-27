import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"
import type { AppMessageKey } from "@/i18n/messages"

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
        <IssueGroup
          titleKey="calendarCouldNotImport"
          issues={errors}
          tone="error"
        />
      )}
      {warnings.length > 0 && (
        <IssueGroup
          titleKey="calendarImportedWithAdjustments"
          issues={warnings}
          tone="warning"
        />
      )}
    </div>
  )
}

function IssueGroup({
  titleKey,
  issues,
  tone,
}: {
  titleKey: AppMessageKey
  issues: CalendarImportIssue[]
  tone: "error" | "warning"
}) {
  const Icon = tone === "error" ? CircleAlert : TriangleAlert
  const t = useAppTranslations()

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
        {t(titleKey)} ({issues.length})
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">
        {issues.slice(0, 5).map((issue, index) => (
          <li key={`${issue.key}-${index}`}>{t(issue.key, issue.values)}</li>
        ))}
        {issues.length > 5 && (
          <li className="text-muted-foreground">
            +{issues.length - 5} <T>moreLowercase</T>
          </li>
        )}
      </ul>
    </section>
  )
}
