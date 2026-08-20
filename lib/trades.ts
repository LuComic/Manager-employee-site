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
  demo?: boolean
}

export type DemoTradeCopy = {
  publisherReason: string
  receiverReason: string
  managerReason: string
  kitchen: string
  frontDesk: string
  diningRoom: string
  bar: string
  yourName: string
}

export const demoTradeSlugs = {
  publisher: "demo-publisher-offer",
  receiver: "demo-receiver-offer",
  manager: "demo-manager-review",
} as const

function demoDate(now: number, dayOffset: number, time: string) {
  const date = new Date(now + dayOffset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  return `${date}T${time}`
}

function demoShift(args: {
  eventId: string
  employeeId: string
  employeeName: string
  start: string
  end: string
  area: string
}): TradeShift {
  return {
    ...args,
    eventId: args.eventId as Id<"events">,
    employeeId: args.employeeId as Id<"employeeProfiles">,
  }
}

export function createDemoTrades(
  now: number,
  copy: DemoTradeCopy
): ShiftTrade[] {
  const createdAt = now - 60 * 60 * 1000
  const mariaShift = demoShift({
    eventId: "demo-event-maria",
    employeeId: "demo-employee-maria",
    employeeName: "Maria Saar",
    start: demoDate(now, 1, "09:00"),
    end: demoDate(now, 1, "17:00"),
    area: copy.kitchen,
  })
  const karlShift = demoShift({
    eventId: "demo-event-karl",
    employeeId: "demo-employee-karl",
    employeeName: "Karl Tamm",
    start: demoDate(now, 3, "12:00"),
    end: demoDate(now, 3, "20:00"),
    area: copy.frontDesk,
  })
  const omarShift = demoShift({
    eventId: "demo-event-omar",
    employeeId: "demo-employee-omar",
    employeeName: "Omar Hassan",
    start: demoDate(now, 4, "08:00"),
    end: demoDate(now, 4, "16:00"),
    area: copy.bar,
  })
  const sofiaShift = demoShift({
    eventId: "demo-event-sofia",
    employeeId: "demo-employee-sofia",
    employeeName: "Sofia Lind",
    start: demoDate(now, 5, "14:00"),
    end: demoDate(now, 5, "22:00"),
    area: copy.kitchen,
  })
  return [
    {
      id: "demo-trade-publisher" as Id<"shiftTrades">,
      slug: demoTradeSlugs.publisher,
      reason: copy.publisherReason,
      status: "offer-pending",
      publisherId: mariaShift.employeeId,
      publisherName: mariaShift.employeeName,
      sourceShift: mariaShift,
      offeredShift: karlShift,
      offeringEmployeeId: karlShift.employeeId,
      viewerRole: "publisher",
      createdAt,
      updatedAt: now,
      demo: true,
    },
    {
      id: "demo-trade-receiver" as Id<"shiftTrades">,
      slug: demoTradeSlugs.receiver,
      reason: copy.receiverReason,
      status: "published",
      publisherId: "demo-employee-liis" as Id<"employeeProfiles">,
      publisherName: "Liis Kask",
      sourceShift: demoShift({
        eventId: "demo-event-liis",
        employeeId: "demo-employee-liis",
        employeeName: "Liis Kask",
        start: demoDate(now, 2, "07:00"),
        end: demoDate(now, 2, "15:00"),
        area: copy.diningRoom,
      }),
      offeredShift: null,
      viewerRole: "employee",
      createdAt,
      updatedAt: now,
      demo: true,
    },
    {
      id: "demo-trade-manager" as Id<"shiftTrades">,
      slug: demoTradeSlugs.manager,
      reason: copy.managerReason,
      status: "confirmed",
      publisherId: omarShift.employeeId,
      publisherName: omarShift.employeeName,
      sourceShift: omarShift,
      offeredShift: sofiaShift,
      offeringEmployeeId: sofiaShift.employeeId,
      viewerRole: "manager",
      createdAt,
      updatedAt: now,
      demo: true,
    },
  ]
}

export function createDemoOfferShifts(
  now: number,
  copy: DemoTradeCopy
): TradeShift[] {
  return [
    demoShift({
      eventId: "demo-event-yours-one",
      employeeId: "demo-employee-you",
      employeeName: copy.yourName,
      start: demoDate(now, 6, "10:00"),
      end: demoDate(now, 6, "18:00"),
      area: copy.frontDesk,
    }),
    demoShift({
      eventId: "demo-event-yours-two",
      employeeId: "demo-employee-you",
      employeeName: copy.yourName,
      start: demoDate(now, 8, "16:00"),
      end: demoDate(now, 8, "23:00"),
      area: copy.bar,
    }),
  ]
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
