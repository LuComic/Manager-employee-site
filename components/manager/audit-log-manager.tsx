"use client"

import { History } from "lucide-react"
import { usePaginatedQuery } from "convex/react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

const actionMessages = {
  created: "auditLogCreated",
  edited: "auditLogEdited",
  deleted: "auditLogDeleted",
  drafted: "auditLogDrafted",
} as const satisfies Record<string, AppMessageKey>

const entityMessages = {
  announcement: "auditEntityAnnouncement",
  attachment: "auditEntityAttachment",
  category: "auditEntityCategory",
  document: "auditEntityDocument",
  employee: "auditEntityEmployee",
  event: "auditEntityEvent",
  faq: "auditEntityFaq",
  guide: "auditEntityGuide",
  helpRequest: "auditEntityHelpRequest",
  workplace: "auditEntityWorkplace",
} as const satisfies Record<string, AppMessageKey>

export function AuditLogManager() {
  const { hub } = useOperations()
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { results, status, loadMore } = usePaginatedQuery(
    api.auditLogs.list,
    hub ? { hubId: hub.id } : "skip",
    { initialNumItems: 50 }
  )

  return (
    <div className="space-y-6">
      <ManagerHeading title="activityLogs" description="auditLogsDescription" />

      {status === "LoadingFirstPage" ? (
        <p role="status" className="text-sm text-muted-foreground">
          <T>loadingActivityLogs</T>
        </p>
      ) : results.length ? (
        <div className="border bg-background">
          <ol className="divide-y">
            {results.map((log) => (
              <li
                key={log._id}
                className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <p className="text-sm leading-6">
                  {t(actionMessages[log.action], {
                    actor: log.actorName,
                    entityType: t(entityMessages[log.entityType]),
                    title: log.entityTitle,
                  })}
                </p>
                <time
                  dateTime={new Date(log.occurredAt).toISOString()}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {new Intl.DateTimeFormat(languageTag, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: hub?.timeZone,
                  }).format(log.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <div className="border-t p-4 text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(50)}
              >
                <T>
                  {status === "LoadingMore"
                    ? "loadingMoreActivityLogs"
                    : "loadMoreActivityLogs"}
                </T>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={History}
          title="noActivityLogs"
          description="noActivityLogsDescription"
        />
      )}
    </div>
  )
}
