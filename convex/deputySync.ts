import { v } from "convex/values"

import { normalizeDeputyEndpoint } from "../lib/deputy"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { env, internalAction, type ActionCtx } from "./_generated/server"

type SyncConnection = {
  hubId: Id<"hubs">
  endpoint: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
}

type DeputyRoster = {
  externalId: string
  startUtc: string
  endUtc: string
  employeeId: string
  employeeName: string
  areaId: string
  areaName: string
  published: boolean
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
  connectionId: Id<"deputyConnections">,
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
  await ctx.runMutation(internal.deputy.storeRefreshedTokens, {
    connectionId,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresInSeconds: tokens.expiresIn,
  })
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
      max: 500,
    }),
  })
}

async function synchronize(
  ctx: ActionCtx,
  connectionId: Id<"deputyConnections">
) {
  let connection: SyncConnection | null = await ctx.runQuery(
    internal.deputy.getConnectionForSync,
    { connectionId }
  )
  if (!connection) return
  const endpoint = normalizeDeputyEndpoint(connection.endpoint)
  if (!endpoint) throw new Error("invalidDeputyEndpoint")
  connection = { ...connection, endpoint }
  if (connection.accessTokenExpiresAt <= Date.now() + 60_000) {
    connection = await refreshAccessToken(ctx, connectionId, connection)
  }

  const now = Date.now()
  const windowStart = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000)
  const windowEnd = Math.floor((now + 180 * 24 * 60 * 60 * 1000) / 1000)
  const rosters: DeputyRoster[] = []
  for (let start = 0; start < 5_000; start += 500) {
    let response = await rosterPage({
      endpoint,
      accessToken: connection.accessToken,
      windowStart,
      windowEnd,
      start,
    })
    if (response.status === 401) {
      connection = await refreshAccessToken(ctx, connectionId, connection)
      response = await rosterPage({
        endpoint,
        accessToken: connection.accessToken,
        windowStart,
        windowEnd,
        start,
      })
    }
    if (!response.ok) throw new Error("deputyRosterSyncFailed")
    const payload: unknown = await response.json()
    const page = Array.isArray(payload)
      ? payload
      : Array.isArray(record(payload)?.data)
        ? (record(payload)!.data as unknown[])
        : null
    if (!page) throw new Error("deputyRosterResponseInvalid")
    for (const item of page) {
      const roster = parseRoster(item)
      if (roster) rosters.push(roster)
    }
    if (page.length < 500) break
  }

  const syncId = crypto.randomUUID()
  for (let index = 0; index < rosters.length; index += 20) {
    await ctx.runMutation(internal.deputy.applyRosterBatch, {
      connectionId,
      syncId,
      rosters: rosters.slice(index, index + 20),
    })
  }
  const windowStartUtc = new Date(windowStart * 1000).toISOString()
  const windowEndUtc = new Date(windowEnd * 1000).toISOString()
  while (
    (await ctx.runMutation(internal.deputy.hideStaleRosters, {
      connectionId,
      syncId,
      windowStartUtc,
      windowEndUtc,
    })) > 0
  ) {
    // Continue in bounded transactions until every stale roster is hidden.
  }
  await ctx.runMutation(internal.deputy.finishSync, { connectionId })
}

export const syncConnection = internalAction({
  args: { connectionId: v.id("deputyConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await synchronize(ctx, args.connectionId)
    } catch (error) {
      await ctx.runMutation(internal.deputy.failSync, {
        connectionId: args.connectionId,
        message:
          error instanceof Error ? error.message : "deputyRosterSyncFailed",
      })
    }
    return null
  },
})

export const syncAllConnections = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const connectionIds: Id<"deputyConnections">[] = await ctx.runQuery(
      internal.deputy.listConnectionIds,
      {}
    )
    for (const connectionId of connectionIds) {
      try {
        await synchronize(ctx, connectionId)
      } catch (error) {
        await ctx.runMutation(internal.deputy.failSync, {
          connectionId,
          message:
            error instanceof Error ? error.message : "deputyRosterSyncFailed",
        })
      }
    }
    return null
  },
})
