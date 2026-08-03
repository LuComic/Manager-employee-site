import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "sync Deputy employee schedules",
  { minutes: 15 },
  internal.deputySync.syncAllConnections,
  {}
)

export default crons
