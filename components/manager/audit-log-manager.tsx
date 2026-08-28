"use client"

import { History } from "lucide-react"
import { useUser } from "@clerk/nextjs"
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
  tradeOffered: "auditLogTradeOffered",
  tradeOfferCancelled: "auditLogTradeOfferCancelled",
  tradeOfferAccepted: "auditLogTradeOfferAccepted",
  tradeOfferDeclined: "auditLogTradeOfferDeclined",
  tradeApproved: "auditLogTradeApproved",
  tradeDeclined: "auditLogTradeDeclined",
  tradeCancelled: "auditLogTradeCancelled",
  tradeRolledBack: "auditLogTradeRolledBack",
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
  shiftTrade: "auditEntityShiftTrade",
  workerNote: "auditEntityWorkerNote",
  workplace: "auditEntityWorkplace",
} as const satisfies Record<string, AppMessageKey>

export function AuditLogManager() {
  const { hub } = useOperations()
  const { user } = useUser()
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { results, status, loadMore } = usePaginatedQuery(
    api.auditLogs.list,
    hub ? { hubId: hub.id } : "skip",
    { initialNumItems: 50 }
  )
  const loadMoreLabel =
    status === "LoadingMore"
      ? t("loadingMoreActivityLogs")
      : t("loadMoreActivityLogs")

  return (
    <div className="space-y-6">
      <ManagerHeading title="activityLogs" description="auditLogsDescription" />

      {status === "LoadingFirstPage" ? (
        <p role="status" className="text-sm text-muted-foreground">
          <T>loadingActivityLogs</T>
        </p>
      ) : results.length ? (
        <div className="space-y-2">
          {results.map((log) => {
            const storedActorName =
              log.actorId === "anonymous"
                ? t("anonymousEmployee")
                : log.actorName
            const actorName =
              (log.actorSubject ?? log.actorId) === user?.id
                ? user.fullName ||
                  user.primaryEmailAddress?.emailAddress ||
                  user.username ||
                  storedActorName
                : storedActorName

            return (
              <article
                key={log._id}
                className="border bg-background p-3 text-sm leading-6 sm:border-0 sm:bg-transparent sm:p-0"
              >
                <time
                  dateTime={new Date(log.occurredAt).toISOString()}
                  className="block text-xs text-muted-foreground sm:inline sm:text-sm"
                >
                  {new Intl.DateTimeFormat(languageTag, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: hub?.timeZone,
                  }).format(log.occurredAt)}
                </time>
                <span className="hidden sm:inline" aria-hidden="true">
                  {" "}
                  —{" "}
                </span>
                <span className="mt-1 block wrap-break-word sm:mt-0 sm:inline">
                  {t(actionMessages[log.action], {
                    actor: actorName,
                    entityType: t(entityMessages[log.entityType]),
                    title: log.entityTitle,
                  })}
                </span>
              </article>
            )
          })}
          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={status === "LoadingMore"}
                onClick={() => loadMore(50)}
              >
                {loadMoreLabel}
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
