"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useQuery } from "convex/react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { WorkersCanEditToggle } from "@/components/manager/workers-can-edit-toggle"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Link } from "@/i18n/navigation"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"
import { createDemoTrades, type ShiftTrade } from "@/lib/trades"
import { tradeStatusLabel } from "@/lib/trades"
import { cn } from "@/lib/utils"

function tradeTone(status: ShiftTrade["status"]) {
  if (status === "published") {
    return "border-success/30 bg-success/10 hover:bg-success/15"
  }
  if (
    status === "offer-pending" ||
    status === "confirmed" ||
    status === "processing"
  ) {
    return "border-warning/40 bg-warning/10 hover:bg-warning/15"
  }
  return "border-border bg-background hover:bg-muted/40"
}

export function TradeManager() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  const now = useState(() => Date.now())[0]
  const trades = useQuery(api.trades.list, hub ? { hubId: hub.id } : "skip") as
    ShiftTrade[] | undefined
  const canPublish = useQuery(
    api.trades.canPublish,
    hub ? { hubId: hub.id } : "skip"
  )
  const demoTrades = createDemoTrades(now, {
    publisherReason: t("demoPublisherTradeReason"),
    receiverReason: t("demoReceiverTradeReason"),
    managerReason: t("demoManagerTradeReason"),
    kitchen: t("demoAreaKitchen"),
    frontDesk: t("demoAreaFrontDesk"),
    diningRoom: t("demoAreaDiningRoom"),
    bar: t("demoAreaBar"),
    yourName: t("demoYourName"),
  })
  const visibleTrades = trades?.length ? trades : demoTrades

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
      ) : (
        <div className="space-y-4">
          {!trades.length && (
            <div className="border bg-muted/30 p-4 text-sm">
              <p className="font-semibold">
                <T>demoTradePreview</T>
              </p>
              <p className="mt-1 text-muted-foreground">
                <T>demoTradePreviewDescription</T>
              </p>
            </div>
          )}
          {visibleTrades.map((trade) => (
            <Link
              key={trade.id}
              href={`/trades/${trade.slug}`}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <div
                className={cn(
                  "border p-4 transition-colors",
                  tradeTone(trade.status)
                )}
              >
                <h2 className="font-semibold">
                  {t("tradeByName", { name: trade.publisherName })}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(tradeStatusLabel[trade.status])} ·
                  {trade.demo ? ` ${t("demo")} ·` : ""}{" "}
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
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
