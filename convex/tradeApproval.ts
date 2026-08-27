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
  attemptId: string
  resuming: boolean
  operation: "approve" | "rollback"
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
  expected: ShiftPayload,
  allowedEmployeeIds: readonly string[],
  nowTimestamp: number
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
  const published = roster?.Published === true || roster?.Published === 1
  const expectedStartTimestamp = Date.parse(expected.startUtc) / 1000
  const expectedEndTimestamp = Date.parse(expected.endUtc) / 1000
  if (
    String(rosterId) !== expected.rosterId ||
    !allowedEmployeeIds.includes(String(employeeId)) ||
    startTimestamp !== expectedStartTimestamp ||
    endTimestamp !== expectedEndTimestamp ||
    String(areaId) !== expected.areaId ||
    published !== expected.published ||
    !published ||
    startTimestamp <= nowTimestamp
  ) {
    throw new Error("deputyShiftTradeStale")
  }
  return {
    rosterId,
    employeeId: String(employeeId),
    startTimestamp,
    endTimestamp,
    areaId,
    published,
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
    // Deputy exposes additional read-only confirmation states (2 and 3), but
    // its roster update API accepts only 0 or 1. A replacement must never
    // inherit the previous assignee's confirmation outcome.
    intConfirmStatus: 0,
    ...(shift.connectStatus !== undefined
      ? { intConnectStatus: shift.connectStatus }
      : {}),
  }
}

async function updateRoster(
  endpoint: string,
  accessToken: string,
  shift: LiveRoster,
  employeeId: string,
  errorMessage:
    "deputySourceRosterUpdateFailed" | "deputyTargetRosterUpdateFailed"
) {
  const response = await fetch(`https://${endpoint}/api/v1/supervise/roster`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(rosterUpdate(shift, employeeId)),
  })
  if (!response.ok) throw new Error(errorMessage)
}

function safeApprovalError(error: unknown) {
  const supported = new Set([
    "deputyIntegrationNotConfigured",
    "deputyShiftTradeUpdateFailed",
    "deputySourceRosterUpdateFailed",
    "deputyTargetRosterUpdateFailed",
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

async function reconcile(
  ctx: ActionCtx,
  tradeId: Id<"shiftTrades">,
  operation: "approve" | "rollback"
) {
  const approval: ApprovalContext = await ctx.runMutation(
    internal.trades.beginApproval,
    { tradeId, operation }
  )
  const endpoint = normalizeDeputyEndpoint(approval.endpoint)
  if (!endpoint) {
    await ctx.runMutation(internal.trades.failApproval, {
      tradeId,
      attemptId: approval.attemptId,
      message: "invalidDeputyEndpoint",
      keepProcessing: approval.resuming,
      operation: approval.operation,
    })
    throw new Error("invalidDeputyEndpoint")
  }
  let accessToken = approval.accessToken
  let deputyWriteSucceeded = false
  try {
    if (approval.accessTokenExpiresAt <= Date.now() + 60_000) {
      accessToken = await refreshToken(ctx, { ...approval, endpoint })
    }
    const allowedEmployeeIds = [
      approval.source.employeeId,
      approval.target.employeeId,
    ]
    const nowTimestamp = Date.now() / 1000
    const [sourceRoster, targetRoster] = await Promise.all([
      loadRoster(
        endpoint,
        accessToken,
        approval.source,
        allowedEmployeeIds,
        nowTimestamp
      ),
      loadRoster(
        endpoint,
        accessToken,
        approval.target,
        allowedEmployeeIds,
        nowTimestamp
      ),
    ])
    if (
      !approval.resuming &&
      (sourceRoster.employeeId !== approval.source.employeeId ||
        targetRoster.employeeId !== approval.target.employeeId)
    ) {
      throw new Error("deputyShiftTradeStale")
    }
    const desiredSourceEmployeeId =
      approval.operation === "approve"
        ? approval.target.employeeId
        : approval.source.employeeId
    const desiredTargetEmployeeId =
      approval.operation === "approve"
        ? approval.source.employeeId
        : approval.target.employeeId
    if (sourceRoster.employeeId !== desiredSourceEmployeeId) {
      await updateRoster(
        endpoint,
        accessToken,
        sourceRoster,
        desiredSourceEmployeeId,
        "deputySourceRosterUpdateFailed"
      )
      deputyWriteSucceeded = true
    }
    if (targetRoster.employeeId !== desiredTargetEmployeeId) {
      await updateRoster(
        endpoint,
        accessToken,
        targetRoster,
        desiredTargetEmployeeId,
        "deputyTargetRosterUpdateFailed"
      )
      deputyWriteSucceeded = true
    }
    await ctx.runMutation(internal.trades.finishApproval, {
      tradeId,
      attemptId: approval.attemptId,
      operation: approval.operation,
    })
  } catch (error) {
    const message = safeApprovalError(error)
    await ctx.runMutation(internal.trades.failApproval, {
      tradeId,
      attemptId: approval.attemptId,
      message,
      // A failed first request has not changed Deputy, so return to manager
      // review. A partial swap stays locked until it is completed or restored.
      keepProcessing: deputyWriteSucceeded || approval.operation === "rollback",
      operation: approval.operation,
    })
    throw new Error(message)
  }
  await ctx.runMutation(internal.deputy.queueSyncAfterTrade, {
    connectionId: approval.connectionId,
  })
  return null
}

export const approve = action({
  args: { tradeId: v.id("shiftTrades") },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await reconcile(ctx, args.tradeId, "approve")
  },
})

export const rollback = action({
  args: { tradeId: v.id("shiftTrades") },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await reconcile(ctx, args.tradeId, "rollback")
  },
})
