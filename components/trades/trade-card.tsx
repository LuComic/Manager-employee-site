"use client"

import { ArrowLeftRight } from "lucide-react"

import { T } from "@/components/translated-text"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import type { ShiftTrade } from "@/lib/trades"
import { tradeStatusIconClass } from "@/lib/trades"

export function TradeCard({ trade }: { trade: ShiftTrade }) {
  return (
    <Link
      href={`/trades/${trade.slug}`}
      className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card className="h-full shadow-none transition-colors group-hover:bg-muted/40">
        <CardContent className="flex items-start gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center ${tradeStatusIconClass(trade.status)}`}
          >
            <ArrowLeftRight className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">
              <T values={{ name: trade.publisherName }}>tradeByName</T>
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {trade.reason}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
