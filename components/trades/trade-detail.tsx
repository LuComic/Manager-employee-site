"use client"

import { useState } from "react"
import {
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  Clock3,
  MapPin,
  UserRound,
} from "lucide-react"
import { useAction, useMutation, useQuery } from "convex/react"

import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Link, useRouter } from "@/i18n/navigation"
import type { AppMessageKey } from "@/i18n/messages"
import {
  useAppErrorTranslation,
  useAppTranslations,
  useLanguageTag,
} from "@/i18n/use-app-translations"
import { formatDate, formatTime } from "@/lib/operations"
import type { ShiftTrade, TradeShift } from "@/lib/trades"
import { tradeStatusLabel } from "@/lib/trades"
import { cn } from "@/lib/utils"

export function TradeDetail({ tradeSlug }: { tradeSlug: string }) {
  const router = useRouter()
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
  const languageTag = useLanguageTag()
  const { hub, showFeedback } = useOperations()
  const now = useState(() => Date.now())[0]
  const queriedTrade = useQuery(
    api.trades.get,
    hub ? { hubId: hub.id, slug: tradeSlug } : "skip"
  ) as ShiftTrade | null | undefined
  const trade = queriedTrade
  const queriedShifts = useQuery(
    api.trades.listMyShifts,
    hub && trade && trade.viewerRole !== "manager"
      ? { hubId: hub.id, now }
      : "skip"
  ) as TradeShift[] | undefined
  const shifts = queriedShifts
  const unpublishTrade = useMutation(api.trades.unpublish)
  const offerTrade = useMutation(api.trades.offer)
  const cancelOffer = useMutation(api.trades.cancelOffer)
  const respondToOffer = useMutation(api.trades.respondToOffer)
  const managerDecline = useMutation(api.trades.managerDecline)
  const managerCancelTrade = useMutation(api.trades.managerCancel)
  const approveTrade = useAction(api.tradeApproval.approve)
  const [selectedShift, setSelectedShift] = useState("")
  const [declineMode, setDeclineMode] = useState<"employee" | "manager" | null>(
    null
  )
  const [declineReason, setDeclineReason] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function run(
    operation: () => Promise<unknown>,
    feedback?: AppMessageKey
  ) {
    setPending(true)
    setError("")
    try {
      await operation()
      if (feedback) showFeedback(feedback)
    } catch (caught) {
      setError(translateError(caught))
    } finally {
      setPending(false)
    }
  }

  if (trade === undefined) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        <T>loadingTrade</T>
      </p>
    )
  }
  if (!trade) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="tradeNotFound"
        description="tradeNoLongerAvailable"
        actionLabel="backToTrades"
        actionHref="/trades"
      />
    )
  }
  const availableOfferShifts = (shifts ?? []).filter(
    (shift) => shift.eventId !== trade.sourceShift.eventId
  )

  async function decline() {
    if (!trade) return
    if (!declineReason.trim()) return setError(t("tradeDeclineReasonRequired"))
    await run(
      () =>
        declineMode === "manager"
          ? managerDecline({ tradeId: trade.id, reason: declineReason })
          : respondToOffer({
              tradeId: trade.id,
              response: "decline",
              reason: declineReason,
            }),
      "tradeDeclined"
    )
    setDeclineMode(null)
    setDeclineReason("")
  }

  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/trades"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "tracking-normal normal-case"
        )}
      >
        <ArrowLeft /> <T>backToTrades</T>
      </Link>
      <Card className="shadow-none">
        <CardHeader className="border-b">
          <Badge variant="secondary">
            <T>{tradeStatusLabel[trade.status]}</T>
          </Badge>
          <CardTitle>
            <h1 className="text-2xl tracking-tight">
              {t("tradeByName", { name: trade.publisherName })}
            </h1>
          </CardTitle>
          <p className="mt-2 max-w-2xl text-muted-foreground">{trade.reason}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={cn("grid gap-4", trade.offeredShift && "md:grid-cols-2")}
          >
            <ShiftCard
              shift={trade.sourceShift}
              label={t("currentShiftForName", {
                name: trade.sourceShift.employeeName,
              })}
              proposedLabel={
                trade.offeredShift
                  ? t("wouldSwitchToNameShift", {
                      name: trade.offeredShift.employeeName,
                    })
                  : undefined
              }
              languageTag={languageTag}
              timeZone={hub?.timeZone}
            />
            {trade.offeredShift && (
              <ShiftCard
                shift={trade.offeredShift}
                label={t("currentShiftForName", {
                  name: trade.offeredShift.employeeName,
                })}
                proposedLabel={t("wouldSwitchToNameShift", {
                  name: trade.sourceShift.employeeName,
                })}
                languageTag={languageTag}
                timeZone={hub?.timeZone}
              />
            )}
          </div>

          {trade.employeeDeclineReason && (
            <Notice
              title="employeeDeclineReason"
              message={trade.employeeDeclineReason}
            />
          )}
          {trade.managerDeclineReason && (
            <Notice
              title="managerDeclineReason"
              message={trade.managerDeclineReason}
            />
          )}
          {trade.deputyError && (
            <Notice
              title="deputyUpdateNeedsRetry"
              message={t(trade.deputyError as AppMessageKey)}
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="border-t pt-5">
            <TradeActions
              trade={trade}
              shifts={availableOfferShifts}
              selectedShift={selectedShift}
              pending={pending}
              languageTag={languageTag}
              timeZone={hub?.timeZone}
              onSelectedShift={setSelectedShift}
              onUnpublish={() =>
                void run(async () => {
                  await unpublishTrade({ tradeId: trade.id })
                  router.push("/trades")
                }, "tradeUnpublished")
              }
              onOffer={() => {
                if (!selectedShift) return setError(t("chooseShiftToOffer"))
                void run(
                  () =>
                    offerTrade({
                      tradeId: trade.id,
                      eventId: selectedShift as Id<"events">,
                    }),
                  "tradeOfferSubmitted"
                )
              }}
              onCancel={() =>
                void run(
                  () => cancelOffer({ tradeId: trade.id }),
                  "tradeOfferCancelled"
                )
              }
              onAccept={() =>
                void run(
                  () =>
                    respondToOffer({
                      tradeId: trade.id,
                      response: "accept",
                    }),
                  "tradeConfirmedForManager"
                )
              }
              onDecline={(mode) => {
                setError("")
                setDeclineMode(mode)
              }}
              onManagerAccept={() =>
                void run(
                  () => approveTrade({ tradeId: trade.id }),
                  "tradeApprovedAndDeputyUpdated"
                )
              }
              onManagerCancel={() =>
                void run(async () => {
                  await managerCancelTrade({ tradeId: trade.id })
                  router.push("/trades")
                }, "tradeUnpublished")
              }
            />
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={declineMode !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeclineMode(null)
            setDeclineReason("")
            setError("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <T>declineTrade</T>
            </DialogTitle>
            <DialogDescription>
              <T>explainWhyTradeDoesNotWork</T>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">
              <T>description</T>
            </Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              maxLength={500}
              onChange={(event) => setDeclineReason(event.target.value)}
              className="min-h-28 border border-input px-3"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineMode(null)}
              disabled={pending}
            >
              <T>cancel</T>
            </Button>
            <Button
              variant="destructive"
              onClick={() => void decline()}
              disabled={pending}
            >
              <T>decline</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

function ShiftCard({
  shift,
  label,
  proposedLabel,
  languageTag,
  timeZone,
}: {
  shift: TradeShift
  label: string
  proposedLabel?: string
  languageTag: string
  timeZone?: string
}) {
  return (
    <div className="border bg-muted/20 p-4">
      <p className="text-sm font-semibold">{label}</p>
      {proposedLabel && (
        <Badge className="mt-2" variant="outline">
          {proposedLabel}
        </Badge>
      )}
      <div className="mt-4 space-y-3 text-sm">
        <p className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" /> {shift.employeeName}
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          {formatDate(shift.start, undefined, timeZone, languageTag)}
        </p>
        <p className="flex items-center gap-2">
          <Clock3 className="size-4 text-primary" />
          {formatTime(shift.start, timeZone, languageTag)}–
          {formatTime(shift.end, timeZone, languageTag)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" /> {shift.area}
        </p>
      </div>
    </div>
  )
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="border bg-muted/30 p-4 text-sm">
      <p className="font-semibold">
        <T>{title}</T>
      </p>
      <p className="mt-1 text-muted-foreground">{message}</p>
    </div>
  )
}

function TradeActions({
  trade,
  shifts,
  selectedShift,
  pending,
  languageTag,
  timeZone,
  onSelectedShift,
  onUnpublish,
  onOffer,
  onCancel,
  onAccept,
  onDecline,
  onManagerAccept,
  onManagerCancel,
}: {
  trade: ShiftTrade
  shifts: TradeShift[]
  selectedShift: string
  pending: boolean
  languageTag: string
  timeZone?: string
  onSelectedShift: (value: string) => void
  onUnpublish: () => void
  onOffer: () => void
  onCancel: () => void
  onAccept: () => void
  onDecline: (mode: "employee" | "manager") => void
  onManagerAccept: () => void
  onManagerCancel: () => void
}) {
  const t = useAppTranslations()
  if (trade.viewerRole === "manager") {
    if (trade.status === "published" || trade.status === "offer-pending") {
      return (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={onManagerCancel}
            disabled={pending}
          >
            <T>cancel</T>
          </Button>
        </div>
      )
    }
    return trade.status === "confirmed" || trade.status === "processing" ? (
      <div className="flex flex-wrap justify-end gap-2">
        {trade.status === "confirmed" && (
          <Button
            variant="destructive"
            onClick={() => onDecline("manager")}
            disabled={pending}
          >
            <T>decline</T>
          </Button>
        )}
        <Button onClick={onManagerAccept} disabled={pending}>
          {trade.status === "processing" ? (
            <T>retryDeputyUpdate</T>
          ) : (
            <T>accept</T>
          )}
        </Button>
      </div>
    ) : null
  }
  if (trade.viewerRole === "publisher") {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {trade.status !== "approved" && trade.status !== "processing" && (
          <Button variant="outline" onClick={onUnpublish} disabled={pending}>
            <T>unpublish</T>
          </Button>
        )}
        {trade.status === "offer-pending" && (
          <>
            <Button
              variant="destructive"
              onClick={() => onDecline("employee")}
              disabled={pending}
            >
              <T>decline</T>
            </Button>
            <Button onClick={onAccept} disabled={pending}>
              <T>accept</T>
            </Button>
          </>
        )}
      </div>
    )
  }
  if (trade.viewerRole === "offerer" && trade.status === "offer-pending") {
    return (
      <div className="flex justify-end">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          <T>cancel</T>
        </Button>
      </div>
    )
  }
  if (trade.viewerRole === "employee" && trade.status === "published") {
    const selected = shifts.find((shift) => shift.eventId === selectedShift)
    return (
      <div className="space-y-2">
        <Label htmlFor="offered-shift">
          <T>shiftToOffer</T>
        </Label>
        <div className="flex items-center justify-between gap-3">
          <Select
            value={selectedShift}
            onValueChange={(value) => onSelectedShift(value ?? "")}
          >
            <SelectTrigger
              id="offered-shift"
              className="min-w-0 flex-1 border border-input bg-background px-3"
            >
              <SelectValue placeholder={t("chooseShift")}>
                {selected
                  ? t("shiftOption", {
                      date: formatDate(
                        selected.start,
                        undefined,
                        timeZone,
                        languageTag
                      ),
                      start: formatTime(selected.start, timeZone, languageTag),
                      end: formatTime(selected.end, timeZone, languageTag),
                      area: selected.area,
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
                      timeZone,
                      languageTag
                    ),
                    start: formatTime(shift.start, timeZone, languageTag),
                    end: formatTime(shift.end, timeZone, languageTag),
                    area: shift.area,
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="shrink-0"
            onClick={onOffer}
            disabled={pending || !shifts.length}
          >
            <ArrowLeftRight /> <T>switch</T>
          </Button>
          {trade.canManage && (
            <Button
              variant="destructive"
              onClick={onManagerCancel}
              disabled={pending}
            >
              <T>cancel</T>
            </Button>
          )}
        </div>
      </div>
    )
  }
  if (
    trade.canManage &&
    trade.viewerRole === "employee" &&
    trade.status === "offer-pending"
  ) {
    return (
      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={onManagerCancel}
          disabled={pending}
        >
          <T>cancel</T>
        </Button>
      </div>
    )
  }
  return null
}
