import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "sync Deputy employee schedules",
  { minutes: 15 },
  internal.deputySync.syncAllConnections,
  { paginationOpts: { numItems: 50, cursor: null } }
)

crons.interval(
  "backfill event assignment start times",
  { hours: 1 },
  internal.trades.backfillEventAssignmentStartUtc,
  { paginationOpts: { numItems: 100, cursor: null } }
)

crons.interval(
  "expire unavailable shift trades",
  { minutes: 15 },
  internal.trades.expireUnavailableTrades,
  { paginationOpts: { numItems: 100, cursor: null } }
)

export default crons
