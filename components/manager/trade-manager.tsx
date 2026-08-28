"use client"

import { ArrowLeftRight, Plus } from "lucide-react"
import { usePaginatedQuery, useQuery } from "convex/react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { WorkersCanEditToggle } from "@/components/manager/workers-can-edit-toggle"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Link } from "@/i18n/navigation"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"
import {
  tradeStatusIconClass,
  tradeStatusLabel,
  type ShiftTrade,
} from "@/lib/trades"

export function TradeManager() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  const {
    results: trades,
    status,
    loadMore,
  } = usePaginatedQuery(api.trades.list, hub ? { hubId: hub.id } : "skip", {
    initialNumItems: 50,
  }) as {
    results: ShiftTrade[]
    status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
    loadMore: (numItems: number) => void
  }
  const canPublish = useQuery(
    api.trades.canPublish,
    hub ? { hubId: hub.id } : "skip"
  )
  return (
    <div className="space-y-6">
      <ManagerHeading
        title="manageShiftTrades"
        description="publishAndManageYourShiftTradeRequests"
        action={
          <div className="flex flex-wrap gap-2">
            <WorkersCanEditToggle section="trades" />
            {canPublish === true && (
              <Link href="/manager/trades/new" className={buttonVariants()}>
                <Plus /> <T>newTrade</T>
              </Link>
            )}
          </div>
        }
      />
      {status === "LoadingFirstPage" ? (
        <p role="status" className="text-sm text-muted-foreground">
          <T>loadingTrades</T>
        </p>
      ) : trades.length ? (
        <div className="space-y-4">
          {trades.map((trade) => (
            <ManagerListItem
              key={trade.id}
              icon={<ArrowLeftRight className="size-5" />}
              iconClassName={tradeStatusIconClass(trade.status)}
              title={t("tradeByName", { name: trade.publisherName })}
              summaryHref={`/trades/${trade.slug}`}
              description={
                <>
                  {t(tradeStatusLabel[trade.status])} ·{" "}
                  {formatDate(
                    trade.sourceShift.start,
                    undefined,
                    hub?.timeZone,
                    languageTag
                  )}
                  ,{" "}
                  {formatTime(
                    trade.sourceShift.start,
                    hub?.timeZone,
                    languageTag
                  )}
                  –
                  {formatTime(
                    trade.sourceShift.end,
                    hub?.timeZone,
                    languageTag
                  )}{" "}
                  · {trade.sourceShift.area} · {trade.reason}
                </>
              }
            />
          ))}
          {status !== "Exhausted" && (
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={() => loadMore(50)}
              disabled={status === "LoadingMore"}
            >
              <T>loadMore</T>
            </button>
          )}
        </div>
      ) : (
        <EmptyState
          icon={ArrowLeftRight}
          title="noShiftTradesYet"
          description="publishShiftToStartTrading"
        />
      )}
    </div>
  )
}
