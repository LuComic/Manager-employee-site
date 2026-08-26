"use client"

import { ArrowLeftRight, Plus } from "lucide-react"
import { useQuery } from "convex/react"

import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { TradeCard } from "@/components/trades/trade-card"
import { T } from "@/components/translated-text"
import { buttonVariants } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { Link } from "@/i18n/navigation"
import type { ShiftTrade } from "@/lib/trades"

export function TradesPage() {
  const { hub } = useOperations()
  const trades = useQuery(api.trades.list, hub ? { hubId: hub.id } : "skip") as
    ShiftTrade[] | undefined
  const canPublish = useQuery(
    api.trades.canPublish,
    hub ? { hubId: hub.id } : "skip"
  )
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
      ) : trades.length ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={ArrowLeftRight}
            title="noShiftTradesAvailable"
            description="publishedShiftTradesAppearHere"
          />
        </div>
      )}
    </div>
  )
}
