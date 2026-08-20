"use client"

import { ArrowLeftRight, CalendarDays, MapPin } from "lucide-react"

import { T } from "@/components/translated-text"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n/navigation"
import { useLanguageTag } from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"
import type { ShiftTrade, TradeShift } from "@/lib/trades"
import { tradeStatusLabel } from "@/lib/trades"

function ShiftLine({ shift }: { shift: TradeShift }) {
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5" />
        {formatDate(shift.start, undefined, hub?.timeZone, languageTag)},{" "}
        {formatTime(shift.start, hub?.timeZone, languageTag)}–
        {formatTime(shift.end, hub?.timeZone, languageTag)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="size-3.5" /> {shift.area}
      </span>
    </div>
  )
}

export function TradeCard({ trade }: { trade: ShiftTrade }) {
  return (
    <Link
      href={`/trades/${trade.slug}`}
      className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card className="h-full shadow-none transition-colors group-hover:bg-muted/40">
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <ArrowLeftRight className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">
                  <T values={{ name: trade.publisherName }}>tradeByName</T>
                </h2>
                <Badge variant="secondary">
                  <T>{tradeStatusLabel[trade.status]}</T>
                </Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {trade.reason}
              </p>
            </div>
          </div>
          <ShiftLine shift={trade.sourceShift} />
          {trade.offeredShift && (
            <>
              <div className="border-t" />
              <ShiftLine shift={trade.offeredShift} />
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
