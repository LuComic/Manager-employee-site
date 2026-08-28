"use client"

import { useState } from "react"
import { ArrowLeft, ArrowLeftRight, CalendarDays } from "lucide-react"
import { useMutation, useQuery } from "convex/react"

import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useRouter } from "@/i18n/navigation"
import {
  useAppErrorTranslation,
  useAppTranslations,
  useLanguageTag,
} from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"
import type { ShiftTrade, TradeShift } from "@/lib/trades"

export function TradeEditor({ tradeSlug }: { tradeSlug?: string }) {
  const { hub } = useOperations()
  const now = useState(() => Date.now())[0]
  const shifts = useQuery(
    api.trades.listMyShifts,
    hub ? { hubId: hub.id, now } : "skip"
  ) as TradeShift[] | undefined
  const trade = useQuery(
    api.trades.get,
    hub && tradeSlug ? { hubId: hub.id, slug: tradeSlug } : "skip"
  ) as ShiftTrade | null | undefined

  if (shifts === undefined || (tradeSlug && trade === undefined)) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        <T>loadingTrade</T>
      </p>
    )
  }
  if (tradeSlug && !trade) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="tradeNotFound"
        description="tradeNoLongerAvailable"
        actionLabel="backToTrades"
        actionHref="/manager/trades"
      />
    )
  }
  if (
    trade &&
    (trade.viewerRole !== "publisher" || trade.status !== "published")
  ) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="tradeCannotBeEdited"
        description="onlyPublishedTradeCanBeEdited"
        actionLabel="backToTrades"
        actionHref="/manager/trades"
      />
    )
  }
  const selectableShifts = trade
    ? [
        trade.sourceShift,
        ...shifts.filter(
          (shift) => shift.eventId !== trade.sourceShift.eventId
        ),
      ]
    : shifts
  return (
    <TradeEditorForm
      key={trade?.id ?? "new"}
      trade={trade ?? undefined}
      shifts={selectableShifts}
    />
  )
}

function TradeEditorForm({
  trade,
  shifts,
}: {
  trade?: ShiftTrade
  shifts: TradeShift[]
}) {
  const router = useRouter()
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
  const languageTag = useLanguageTag()
  const { hub, showFeedback } = useOperations()
  const createTrade = useMutation(api.trades.create)
  const editTrade = useMutation(api.trades.edit)
  const [eventId, setEventId] = useState<string>(
    trade?.sourceShift.eventId ?? shifts[0]?.eventId ?? ""
  )
  const [reason, setReason] = useState(trade?.reason ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const selectedShift = shifts.find((shift) => shift.eventId === eventId)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!hub || !eventId) return setError(t("chooseShiftToTrade"))
    if (!reason.trim()) return setError(t("tradeReasonRequired"))
    setSaving(true)
    setError("")
    try {
      if (trade) {
        await editTrade({
          tradeId: trade.id,
          sourceEventId: eventId as Id<"events">,
          reason,
        })
      } else {
        await createTrade({
          hubId: hub.id,
          sourceEventId: eventId as Id<"events">,
          reason,
        })
      }
      showFeedback(trade ? "tradeSaved" : "tradePublished")
      router.push("/manager/trades")
    } catch (caught) {
      setError(translateError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/manager/trades")}
        >
          <ArrowLeft /> <T>backToTrades</T>
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          <T>{trade ? "editTrade" : "createTrade"}</T>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <T>chooseShiftAndExplainWhySwap</T>
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" /> <T>tradeDetails</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="trade-shift">
                <T>shiftToTrade</T>
              </Label>
              <Select
                value={eventId}
                onValueChange={(value) => setEventId(value ?? "")}
              >
                <SelectTrigger
                  id="trade-shift"
                  className="w-full border border-input bg-background px-3"
                >
                  <SelectValue placeholder={t("chooseShift")}>
                    {selectedShift
                      ? t("shiftOption", {
                          date: formatDate(
                            selectedShift.start,
                            undefined,
                            hub?.timeZone,
                            languageTag
                          ),
                          start: formatTime(
                            selectedShift.start,
                            hub?.timeZone,
                            languageTag
                          ),
                          end: formatTime(
                            selectedShift.end,
                            hub?.timeZone,
                            languageTag
                          ),
                          area: selectedShift.area,
                        })
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {shifts.map((shift) => (
                    <SelectItem key={shift.eventId} value={shift.eventId}>
                      {t("shiftOption", {
                        date: formatDate(
                          shift.start,
                          undefined,
                          hub?.timeZone,
                          languageTag
                        ),
                        start: formatTime(
                          shift.start,
                          hub?.timeZone,
                          languageTag
                        ),
                        end: formatTime(shift.end, hub?.timeZone, languageTag),
                        area: shift.area,
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!shifts.length && (
                <p className="text-sm text-muted-foreground">
                  <T>noUpcomingDeputyShifts</T>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade-reason">
                <T>reason</T>
              </Label>
              <Textarea
                id="trade-reason"
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("tradeReasonPlaceholder")}
                className="min-h-32 border border-input px-3"
              />
              <p className="text-xs text-muted-foreground">
                {reason.length}/500
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="h-fit shadow-none">
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <T>publishingNotifiesEmployees</T>
            </p>
            <Button
              type="submit"
              className="w-full"
              disabled={saving || !shifts.length}
            >
              <ArrowLeftRight />
              <T>{saving ? "saving" : trade ? "save" : "publish"}</T>
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
