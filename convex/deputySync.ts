import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

import {
  DEPUTY_SYNC_LOOKAHEAD_DAYS,
  DEPUTY_SYNC_LOOKBACK_DAYS,
  DEPUTY_SYNC_MAX_ROSTERS,
  normalizeDeputyEndpoint,
} from "../lib/deputy"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { env, internalAction, type ActionCtx } from "./_generated/server"

type SyncConnection = {
  hubId: Id<"hubs">
  endpoint: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
  generation: number
}

type SyncJob = {
  connectionId: Id<"deputyConnections">
  generation: number
  syncId: string
}

type DeputyRoster = {
  externalId: string
  startUtc: string
  endUtc: string
  employeeId: string
  employeeName: string
  employeeEmail?: string
  areaId: string
  areaName: string
  published: boolean
}

type DeputyEmployee = {
  id: string
  email?: string
}

const SYNC_ERROR_MESSAGES = new Set([
  "deputyIntegrationNotConfigured",
  "deputyRosterLimitExceeded",
  "deputyRosterResponseInvalid",
  "deputyRosterSyncFailed",
  "deputySyncSuperseded",
  "deputyTokenRefreshFailed",
  "invalidDeputyEndpoint",
])

function safeSyncErrorMessage(error: unknown) {
  return error instanceof Error && SYNC_ERROR_MESSAGES.has(error.message)
    ? error.message
    : "deputyRosterSyncFailed"
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function idValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : stringValue(value)
}

function unixTime(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return new Date(value * 1000).toISOString()
}

function nestedRecord(value: unknown, ...keys: string[]) {
  let current = record(value)
  for (const key of keys) {
    current = current ? record(current[key]) : null
  }
  return current
}

function responseRecords(value: unknown) {
  return Array.isArray(value)
    ? value
    : Array.isArray(record(value)?.data)
      ? (record(value)!.data as unknown[])
      : null
}

function parseEmployee(value: unknown): DeputyEmployee | null {
  const employee = record(value)
  if (!employee) return null
  const id = idValue(employee.Id)
  if (!id) return null
  const contact = record(employee.ContactObject)
  const email1 = stringValue(contact?.Email1)
  const email2 = stringValue(contact?.Email2)
  const primaryEmail = idValue(contact?.PrimaryEmail)
  const email =
    (primaryEmail === "2" ? (email2 ?? email1) : (email1 ?? email2)) ??
    stringValue(employee.Email)
  return { id, ...(email ? { email } : {}) }
}

function parseRoster(value: unknown): DeputyRoster | null {
  const roster = record(value)
  if (!roster) return null
  const externalId = idValue(roster.Id)
  const startUtc = unixTime(roster.StartTime)
  const endUtc = unixTime(roster.EndTime)
  const employeeId = idValue(roster.Employee)
  const areaId = idValue(roster.OperationalUnit)
  const metadataEmployee = nestedRecord(roster._DPMetaData, "EmployeeInfo")
  const joinedEmployee = record(roster.EmployeeObject)
  const metadataArea = nestedRecord(roster._DPMetaData, "OperationalUnitInfo")
  const joinedArea = record(roster.OperationalUnitObject)
  const employeeName =
    stringValue(metadataEmployee?.DisplayName) ??
    stringValue(joinedEmployee?.DisplayName)
  const areaName =
    stringValue(metadataArea?.OperationalUnitName) ??
    stringValue(joinedArea?.OperationalUnitName)
  if (
    !externalId ||
    !startUtc ||
    !endUtc ||
    !employeeId ||
    !employeeName ||
    !areaId ||
    !areaName ||
    Date.parse(endUtc) <= Date.parse(startUtc)
  ) {
    return null
  }
  return {
    externalId,
    startUtc,
    endUtc,
    employeeId,
    employeeName,
    areaId,
    areaName,
    published: roster.Published === true || roster.Published === 1,
  }
}

function tokenResponse(value: unknown) {
  const result = record(value)
  const accessToken = stringValue(result?.access_token)
  const refreshToken = stringValue(result?.refresh_token)
  const expiresIn = result?.expires_in
  if (
    !accessToken ||
    !refreshToken ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn)
  ) {
    throw new Error("deputyTokenRefreshFailed")
  }
  return { accessToken, refreshToken, expiresIn }
}

async function refreshAccessToken(
  ctx: ActionCtx,
  job: SyncJob,
  connection: SyncConnection
) {
  const clientId = env.DEPUTY_CLIENT_ID
  const clientSecret = env.DEPUTY_CLIENT_SECRET
  const redirectUri = env.DEPUTY_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("deputyIntegrationNotConfigured")
  }
  const endpoint = normalizeDeputyEndpoint(connection.endpoint)
  if (!endpoint) throw new Error("invalidDeputyEndpoint")
  const response = await fetch(`https://${endpoint}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
      scope: "longlife_refresh_token",
    }),
  })
  if (!response.ok) throw new Error("deputyTokenRefreshFailed")
  const tokens = tokenResponse(await response.json())
  const stored: boolean = await ctx.runMutation(
    internal.deputy.storeRefreshedTokens,
    {
      ...job,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresInSeconds: tokens.expiresIn,
    }
  )
  if (!stored) throw new Error("deputySyncSuperseded")
  return {
    ...connection,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
  }
}

async function rosterPage(args: {
  endpoint: string
  accessToken: string
  windowStart: number
  windowEnd: number
  start: number
  max: number
}) {
  return await fetch(`https://${args.endpoint}/api/v1/resource/Roster/QUERY`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      search: {
        s1: { field: "StartTime", data: args.windowStart, type: "ge" },
        s2: { field: "StartTime", data: args.windowEnd, type: "le" },
      },
      join: ["EmployeeObject", "OperationalUnitObject"],
      sort: { StartTime: "asc" },
      start: args.start,
      max: args.max,
    }),
  })
}

async function employeePage(args: {
  endpoint: string
  accessToken: string
  employeeIds: string[]
}) {
  return await fetch(
    `https://${args.endpoint}/api/v1/resource/Employee/QUERY`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        search: {
          s1: { field: "Id", data: args.employeeIds, type: "in" },
        },
        join: ["ContactObject"],
        max: args.employeeIds.length,
      }),
    }
  )
}

async function synchronize(ctx: ActionCtx, job: SyncJob) {
  const connection: SyncConnection | null = await ctx.runQuery(
    internal.deputy.getConnectionForSync,
    job
  )
  if (!connection) return
  const endpoint = normalizeDeputyEndpoint(connection.endpoint)
  if (!endpoint) throw new Error("invalidDeputyEndpoint")
  let activeConnection: SyncConnection = { ...connection, endpoint }
  if (activeConnection.accessTokenExpiresAt <= Date.now() + 60_000) {
    activeConnection = await refreshAccessToken(ctx, job, activeConnection)
  }

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const windowStart = Math.floor(
    (now - DEPUTY_SYNC_LOOKBACK_DAYS * dayMs) / 1000
  )
  const windowEnd = Math.floor(
    (now + DEPUTY_SYNC_LOOKAHEAD_DAYS * dayMs) / 1000
  )

  async function loadRosterPage(start: number, max: number) {
    let response = await rosterPage({
      endpoint: activeConnection.endpoint,
      accessToken: activeConnection.accessToken,
      windowStart,
      windowEnd,
      start,
      max,
    })
    if (response.status === 401) {
      activeConnection = await refreshAccessToken(ctx, job, activeConnection)
      response = await rosterPage({
        endpoint: activeConnection.endpoint,
        accessToken: activeConnection.accessToken,
        windowStart,
        windowEnd,
        start,
        max,
      })
    }
    if (!response.ok) throw new Error("deputyRosterSyncFailed")
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new Error("deputyRosterResponseInvalid")
    }
    const page = responseRecords(payload)
    if (!page) throw new Error("deputyRosterResponseInvalid")
    return page
  }

  const page = await loadRosterPage(0, DEPUTY_SYNC_MAX_ROSTERS)
  if (page.length > DEPUTY_SYNC_MAX_ROSTERS) {
    throw new Error("deputyRosterLimitExceeded")
  }
  if (page.length === DEPUTY_SYNC_MAX_ROSTERS) {
    const overflowProbe = await loadRosterPage(DEPUTY_SYNC_MAX_ROSTERS, 1)
    if (overflowProbe.length > 0) {
      throw new Error("deputyRosterLimitExceeded")
    }
  }
  const rosters = page.map(parseRoster)
  if (rosters.some((roster) => roster === null)) {
    throw new Error("deputyRosterResponseInvalid")
  }
  const validRosters = rosters as DeputyRoster[]
  if (
    new Set(validRosters.map((roster) => roster.externalId)).size !==
    validRosters.length
  ) {
    throw new Error("deputyRosterResponseInvalid")
  }

  const employeeIds = [
    ...new Set(validRosters.map((roster) => roster.employeeId)),
  ]
  const employeesById = new Map<string, DeputyEmployee>()
  if (employeeIds.length) {
    let response = await employeePage({
      endpoint: activeConnection.endpoint,
      accessToken: activeConnection.accessToken,
      employeeIds,
    })
    if (response.status === 401) {
      activeConnection = await refreshAccessToken(ctx, job, activeConnection)
      response = await employeePage({
        endpoint: activeConnection.endpoint,
        accessToken: activeConnection.accessToken,
        employeeIds,
      })
    }
    if (!response.ok) throw new Error("deputyRosterSyncFailed")
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new Error("deputyRosterResponseInvalid")
    }
    const page = responseRecords(payload)
    if (!page) throw new Error("deputyRosterResponseInvalid")
    for (const value of page) {
      const employee = parseEmployee(value)
      if (!employee || employeesById.has(employee.id)) {
        throw new Error("deputyRosterResponseInvalid")
      }
      employeesById.set(employee.id, employee)
    }
  }

  const duplicateEmails = new Set<string>()
  const deputyEmployeeIdByEmail = new Map<string, string>()
  for (const employee of employeesById.values()) {
    if (!employee.email) continue
    const email = employee.email.toLocaleLowerCase()
    const priorEmployeeId = deputyEmployeeIdByEmail.get(email)
    if (priorEmployeeId && priorEmployeeId !== employee.id) {
      duplicateEmails.add(email)
    } else {
      deputyEmployeeIdByEmail.set(email, employee.id)
    }
  }
  const enrichedRosters = validRosters.map((roster) => {
    const email = employeesById.get(roster.employeeId)?.email
    return {
      ...roster,
      ...(email && !duplicateEmails.has(email.toLocaleLowerCase())
        ? { employeeEmail: email }
        : {}),
    }
  })

  for (let index = 0; index < enrichedRosters.length; index += 20) {
    const applied: boolean = await ctx.runMutation(
      internal.deputy.applyRosterBatch,
      {
        ...job,
        rosters: enrichedRosters.slice(index, index + 20),
      }
    )
    if (!applied) return
  }
  const windowStartUtc = new Date(windowStart * 1000).toISOString()
  const windowEndUtc = new Date(windowEnd * 1000).toISOString()
  while (true) {
    const result: { active: boolean; updated: number } = await ctx.runMutation(
      internal.deputy.hideStaleRosters,
      {
        ...job,
        windowStartUtc,
        windowEndUtc,
      }
    )
    if (!result.active) return
    if (result.updated === 0) break
  }
  for (const [direction, boundaryUtc] of [
    ["before", windowStartUtc],
    ["after", windowEndUtc],
  ] as const) {
    while (true) {
      const result: { active: boolean; updated: number } =
        await ctx.runMutation(internal.deputy.hideRostersOutsideWindow, {
          ...job,
          direction,
          boundaryUtc,
        })
      if (!result.active) return
      if (result.updated === 0) break
    }
  }
  await ctx.runMutation(internal.deputy.finishSync, job)
}

export const syncConnection = internalAction({
  args: {
    connectionId: v.id("deputyConnections"),
    generation: v.number(),
    syncId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await synchronize(ctx, args)
    } catch (error) {
      await ctx.runMutation(internal.deputy.failSync, {
        ...args,
        message: safeSyncErrorMessage(error),
      })
    }
    return null
  },
})

export const syncAllConnections = internalAction({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result: {
      page: Array<{
        connectionId: Id<"deputyConnections">
        generation: number
      }>
      isDone: boolean
      continueCursor: string
    } = await ctx.runQuery(internal.deputy.listConnectionJobs, {
      paginationOpts: args.paginationOpts,
    })
    for (const job of result.page) {
      await ctx.runMutation(internal.deputy.claimScheduledSync, job)
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.deputySync.syncAllConnections, {
        paginationOpts: {
          ...args.paginationOpts,
          cursor: result.continueCursor,
        },
      })
    }
    return null
  },
})
