"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { useQuery } from "convex/react"

import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { TradeCard } from "@/components/trades/trade-card"
import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Link } from "@/i18n/navigation"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { createDemoTrades, type ShiftTrade } from "@/lib/trades"

export function TradesPage() {
  const t = useAppTranslations()
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
    <div>
      <PageHeading
        title="trades"
        description="browseAvailableAndPendingShiftTrades"
        action={
          canPublish === true ? (
            <Link href="/manager/trades/new" className={buttonVariants()}>
              <Plus /> <T>newTrade</T>
            </Link>
          ) : undefined
        }
      />
      {trades === undefined ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          <T>loadingTrades</T>
        </p>
      ) : (
        <div className="mt-6 space-y-4">
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTrades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
