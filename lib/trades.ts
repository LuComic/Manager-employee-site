import type { Id } from "@/convex/_generated/dataModel"
import type { AppMessageKey } from "@/i18n/messages"

export type TradeStatus =
  | "published"
  | "offer-pending"
  | "confirmed"
  | "processing"
  | "approved"
  | "manager-declined"
  | "unpublished"

export type TradeShift = {
  eventId: Id<"events">
  employeeId: Id<"employeeProfiles">
  employeeName: string
  start: string
  end: string
  area: string
}

export type ShiftTrade = {
  id: Id<"shiftTrades">
  slug: string
  reason: string
  status: TradeStatus
  publisherId: Id<"employeeProfiles">
  publisherName: string
  sourceShift: TradeShift
  offeredShift: TradeShift | null
  offeringEmployeeId?: Id<"employeeProfiles">
  employeeDeclineReason?: string
  managerDeclineReason?: string
  deputyError?: string
  viewerRole: "publisher" | "offerer" | "manager" | "employee"
  createdAt: number
  updatedAt: number
}

export const tradeStatusLabel: Record<TradeStatus, AppMessageKey> = {
  published: "tradeStatusAvailable",
  "offer-pending": "tradeStatusOfferPending",
  confirmed: "tradeStatusManagerReview",
  processing: "tradeStatusUpdatingDeputy",
  approved: "tradeStatusApproved",
  "manager-declined": "tradeStatusDeclined",
  unpublished: "tradeStatusUnpublished",
}

export function tradeStatusIconClass(status: TradeStatus) {
  if (status === "published") return "bg-primary/10 text-primary"
  if (
    status === "offer-pending" ||
    status === "confirmed" ||
    status === "processing"
  ) {
    return "bg-warning/10 text-warning"
  }
  return "bg-muted text-muted-foreground"
}
