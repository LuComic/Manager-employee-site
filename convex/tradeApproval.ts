import { v } from "convex/values"

import { normalizeDeputyEndpoint } from "../lib/deputy"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { action, env, type ActionCtx } from "./_generated/server"

type ShiftPayload = {
  rosterId: string
  employeeId: string
  startUtc: string
  endUtc: string
  areaId: string
  published: boolean
}

type LiveRoster = {
  rosterId: number
  employeeId: string
  startTimestamp: number
  endTimestamp: number
  areaId: number
  published: boolean
  mealbreakMinutes: number
  open: boolean
  confirmStatus: number
  connectStatus?: number
}

type ApprovalContext = {
  connectionId: Id<"deputyConnections">
  tokenVersion: number
  endpoint: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: number
  source: ShiftPayload
  target: ShiftPayload
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

async function refreshToken(ctx: ActionCtx, approval: ApprovalContext) {
  const clientId = env.DEPUTY_CLIENT_ID
  const clientSecret = env.DEPUTY_CLIENT_SECRET
  const redirectUri = env.DEPUTY_OAUTH_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("deputyIntegrationNotConfigured")
  }
  const response = await fetch(
    `https://${approval.endpoint}/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "refresh_token",
        refresh_token: approval.refreshToken,
        scope: "longlife_refresh_token",
      }),
    }
  )
  if (!response.ok) throw new Error("deputyTokenRefreshFailed")
  const payload = record(await response.json())
  const accessToken = stringValue(payload?.access_token)
  const refreshTokenValue = stringValue(payload?.refresh_token)
  const expiresIn = payload?.expires_in
  if (
    !accessToken ||
    !refreshTokenValue ||
    typeof expiresIn !== "number" ||
    !Number.isFinite(expiresIn)
  ) {
    throw new Error("deputyTokenRefreshFailed")
  }
  const stored: boolean = await ctx.runMutation(
    internal.deputy.storeTradeRefreshedTokens,
    {
      connectionId: approval.connectionId,
      expectedTokenVersion: approval.tokenVersion,
      accessToken,
      refreshToken: refreshTokenValue,
      expiresInSeconds: expiresIn,
    }
  )
  if (!stored) throw new Error("deputySyncSuperseded")
  return accessToken
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function mealbreakMinutes(value: unknown) {
  const numeric = finiteNumber(value)
  if (numeric !== null) return Math.max(0, numeric)
  if (typeof value !== "string") return 0
  const match = /(?:T|^)(\d{1,2}):(\d{2})/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0
}

async function loadRoster(
  endpoint: string,
  accessToken: string,
  expected: ShiftPayload
): Promise<LiveRoster> {
  const response = await fetch(
    `https://${endpoint}/api/v1/resource/Roster/${expected.rosterId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!response.ok) throw new Error("deputyShiftTradeUpdateFailed")
  const payload = record(await response.json())
  const roster = record(payload?.data) ?? payload
  const rosterId = finiteNumber(roster?.Id)
  const employeeId = finiteNumber(roster?.Employee)
  const startTimestamp = finiteNumber(roster?.StartTime)
  const endTimestamp = finiteNumber(roster?.EndTime)
  const areaId = finiteNumber(roster?.OperationalUnit)
  if (
    rosterId === null ||
    employeeId === null ||
    startTimestamp === null ||
    endTimestamp === null ||
    areaId === null
  ) {
    throw new Error("deputyRosterResponseInvalid")
  }
  if (String(employeeId) !== expected.employeeId) {
    throw new Error("deputyShiftTradeStale")
  }
  return {
    rosterId,
    employeeId: String(employeeId),
    startTimestamp,
    endTimestamp,
    areaId,
    published: roster?.Published === true || roster?.Published === 1,
    mealbreakMinutes: mealbreakMinutes(roster?.Mealbreak),
    open: roster?.Open === true || roster?.Open === 1,
    confirmStatus: finiteNumber(roster?.ConfirmStatus) ?? 0,
    ...(finiteNumber(roster?.ConnectStatus) !== null
      ? { connectStatus: finiteNumber(roster?.ConnectStatus)! }
      : {}),
  }
}

function rosterUpdate(shift: LiveRoster, employeeId: string) {
  const numericEmployeeId = finiteNumber(employeeId)
  if (numericEmployeeId === null) throw new Error("deputyRosterResponseInvalid")
  return {
    intRosterId: shift.rosterId,
    intStartTimestamp: shift.startTimestamp,
    intEndTimestamp: shift.endTimestamp,
    intRosterEmployee: numericEmployeeId,
    blnPublish: shift.published,
    intMealbreakMinute: shift.mealbreakMinutes,
    intOpunitId: shift.areaId,
    blnForceOverwrite: 0,
    blnOpen: shift.open ? 1 : 0,
    strComment: "Shift trade approved in Workhal",
    intConfirmStatus: shift.confirmStatus,
    ...(shift.connectStatus !== undefined
      ? { intConnectStatus: shift.connectStatus }
      : {}),
  }
}

async function updateRoster(
  endpoint: string,
  accessToken: string,
  shift: LiveRoster,
  employeeId: string
) {
  const response = await fetch(`https://${endpoint}/api/v1/supervise/roster`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rosterUpdate(shift, employeeId)),
  })
  if (!response.ok) throw new Error("deputyShiftTradeUpdateFailed")
}

function safeApprovalError(error: unknown) {
  const supported = new Set([
    "deputyIntegrationNotConfigured",
    "deputyShiftTradeUpdateFailed",
    "deputyShiftTradeStale",
    "deputyRosterResponseInvalid",
    "deputySyncSuperseded",
    "deputyTokenRefreshFailed",
    "invalidDeputyEndpoint",
  ])
  return error instanceof Error && supported.has(error.message)
    ? error.message
    : "deputyShiftTradeUpdateFailed"
}

export const approve = action({
  args: { tradeId: v.id("shiftTrades") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const approval: ApprovalContext = await ctx.runMutation(
      internal.trades.beginApproval,
      args
    )
    const endpoint = normalizeDeputyEndpoint(approval.endpoint)
    if (!endpoint) {
      await ctx.runMutation(internal.trades.failApproval, {
        tradeId: args.tradeId,
        message: "invalidDeputyEndpoint",
      })
      throw new Error("invalidDeputyEndpoint")
    }
    let accessToken = approval.accessToken
    try {
      if (approval.accessTokenExpiresAt <= Date.now() + 60_000) {
        accessToken = await refreshToken(ctx, { ...approval, endpoint })
      }
      const [sourceRoster, targetRoster] = await Promise.all([
        loadRoster(endpoint, accessToken, approval.source),
        loadRoster(endpoint, accessToken, approval.target),
      ])
      await updateRoster(
        endpoint,
        accessToken,
        sourceRoster,
        approval.target.employeeId
      )
      try {
        await updateRoster(
          endpoint,
          accessToken,
          targetRoster,
          approval.source.employeeId
        )
      } catch (error) {
        await updateRoster(
          endpoint,
          accessToken,
          sourceRoster,
          approval.source.employeeId
        ).catch(() => undefined)
        throw error
      }
    } catch (error) {
      const message = safeApprovalError(error)
      await ctx.runMutation(internal.trades.failApproval, {
        tradeId: args.tradeId,
        message,
      })
      throw new Error(message)
    }
    await ctx.runMutation(internal.trades.finishApproval, args)
    return null
  },
})
