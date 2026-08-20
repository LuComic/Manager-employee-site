import { describe, expect, test } from "vitest"

import { createDemoOfferShifts, createDemoTrades } from "@/lib/trades"

const copy = {
  publisherReason: "Publisher reason",
  receiverReason: "Receiver reason",
  managerReason: "Manager reason",
  kitchen: "Kitchen",
  frontDesk: "Front desk",
  diningRoom: "Dining room",
  bar: "Bar",
  yourName: "Your demo shift",
}

describe("trade demo fixtures", () => {
  test("covers publisher, receiving employee, and manager review states", () => {
    const trades = createDemoTrades(Date.UTC(2030, 0, 1), copy)

    expect(trades).toHaveLength(3)
    expect(trades.map((trade) => trade.viewerRole)).toEqual([
      "publisher",
      "employee",
      "manager",
    ])
    expect(trades.map((trade) => trade.status)).toEqual([
      "offer-pending",
      "published",
      "confirmed",
    ])
    expect(trades.every((trade) => trade.demo)).toBe(true)
    expect(trades[0].offeredShift).not.toBeNull()
    expect(trades[1].offeredShift).toBeNull()
  })

  test("provides selectable shifts for the receiving employee preview", () => {
    const shifts = createDemoOfferShifts(Date.UTC(2030, 0, 1), copy)

    expect(shifts).toHaveLength(2)
    expect(shifts.every((shift) => shift.employeeName === copy.yourName)).toBe(
      true
    )
  })
})
