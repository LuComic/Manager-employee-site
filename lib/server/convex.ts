import "server-only"

import { ConvexHttpClient } from "convex/browser"

export function convexServerClient(token: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL")
  const client = new ConvexHttpClient(url)
  client.setAuth(token)
  return client
}

export function safeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback
  const message = error.message
    .replace(/^.*Uncaught Error: /, "")
    .replace(/\s+at handler[\s\S]*$/, "")
    .slice(0, 500)
    .trim()
  return /^[a-z][A-Za-z0-9]*$/.test(message) ? message : fallback
}

export function randomCredential(bytes = 32) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return Buffer.from(values).toString("base64url")
}
