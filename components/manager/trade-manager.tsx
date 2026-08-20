"use client"

import { ArrowLeftRight, Eye, FilePenLine, Plus } from "lucide-react"
import { useQuery } from "convex/react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { WorkersCanEditToggle } from "@/components/manager/workers-can-edit-toggle"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Link } from "@/i18n/navigation"
import { useLanguageTag } from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"
import type { ShiftTrade } from "@/lib/trades"
import { tradeStatusLabel } from "@/lib/trades"
import { cn } from "@/lib/utils"

export function TradeManager() {
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  const trades = useQuery(api.trades.list, hub ? { hubId: hub.id } : "skip") as
    ShiftTrade[] | undefined
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
      {trades === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          <T>loadingTrades</T>
        </p>
      ) : trades.length ? (
        <div className="space-y-4">
          {trades.map((trade) => (
            <ManagerListItem
              key={trade.id}
              icon={<ArrowLeftRight className="size-5" />}
              title={trade.publisherName}
              metadata={[
                <Badge key="status" variant="secondary">
                  <T>{tradeStatusLabel[trade.status]}</T>
                </Badge>,
              ]}
              description={
                <>
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
              actions={
                <>
                  <Link
                    href={`/trades/${trade.slug}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "min-h-11 sm:min-h-9"
                    )}
                  >
                    <Eye /> <T>view</T>
                  </Link>
                  {trade.viewerRole === "publisher" &&
                    trade.status === "published" && (
                      <Link
                        href={`/manager/trades/${trade.slug}/edit`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "min-h-11 sm:min-h-9"
                        )}
                      >
                        <FilePenLine /> <T>edit</T>
                      </Link>
                    )}
                </>
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ArrowLeftRight}
          title="noShiftTradesYet"
          description="publishShiftToStartTrading"
          actionLabel={canPublish === true ? "newTrade" : undefined}
          actionHref={canPublish === true ? "/manager/trades/new" : undefined}
        />
      )}
    </div>
  )
}
