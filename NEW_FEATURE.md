# Schedules and Shift Trades

Update the schedules feature and expand the use of the Deputy API.

## Schedules tool

Move the worker schedules synced from Deputy out of **Events** in the manager area. They should remain unchanged on the employee site.

Create a separate **Schedules** tool under **More tools**. The `/schedules` page should use the same list style as other pages, with schedules displayed in a single column and grouped under small headings for each day and date.

Because schedules will now be separate, remove all worker-schedule displays, controls, and toggles from `/manager/calendar`.

## Shift trades

Add a shift-trading feature to the schedules page. An employee should be able to publish a shift they would like to swap, and another employee should be able to offer one of their own shifts in exchange.

Example flow:

1. Employee 1 selects a shift and adds a short reason, such as: “I can’t make it on the 15th because of a birthday party. Could anyone please switch?”
2. After publishing, other employees receive a notification. Employee 2 can offer one of their own shifts in exchange for Employee 1’s shift.
3. Employee 1 reviews the proposed shift. If it works for them, they confirm the trade; if not, they decline it with a reason.
4. The manager reviews the confirmed trade and approves or declines it.
5. When the manager approves it, the Deputy API updates both employees’ shifts.

Before implementation, confirm that the Deputy API supports changing or swapping employee shifts for this use case. If it does not, stop the task and do not continue.

## UI

### Trade creation

The manager-side trade area, where employees create and manage trades, should include `/new` and `/edit` routes for creating and modifying a trade. These should match the existing `/new` and `/edit` route UIs.

### Employee area

Add a **Trades** section under **Workplace**. It should list all available and pending trades.

The main `/trades` page should use the same grid layout as other employee-facing pages. A specific trade page should match the UI of `/calendar/[event]`.

The page title should read `Trade by {employee name}`. In the initial state, show only the shift the publisher wants to trade. Once another employee has offered a shift, show both shifts: Employee 1’s original shift and Employee 2’s offered shift. Labels must clearly and simply show whose shift is whose, which shifts are current/original, and what the proposed swap is.

For the publishing employee, show **Unpublish** by default. After another employee offers a shift, also show:

- **Accept**, if the offered shift works. This confirms the trade and notifies the manager.
- **Decline**, which requires a description if the offered shift does not work.

For the employee making an offer, show:

- **Switch**, which opens or displays a selector for choosing their shift to offer.
- **Cancel**, shown after they submit an offer; it removes their proposal.

### Manager review

When Employee 1 confirms a trade proposal, notify the manager with a message such as: “John and Mary would like to trade shifts.” Clicking the notification should open that trade’s detail page.

The manager should use the same trade-detail interface as employees—the page that matches `/calendar/[event]`—and it may be the exact same route. The trade and shift information should remain the same, but the Employee 1 and Employee 2 actions should be replaced with only these manager actions:

- **Decline**, which requires a description.
- **Accept**, which approves the trade and triggers the Deputy update.

## Access control

Managers must be able to enable or disable this feature for employees. Because `/manager/trades` must be accessible to employees so they can publish trades, the feature toggle should either be hidden from non-managers or moved to `/manager/employees`.
