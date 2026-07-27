import "server-only"

import { ConvexHttpClient } from "convex/browser"

import { extractAppErrorKey } from "@/lib/app-error"

export function convexServerClient(token: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error("Missing NEXT_PUBLIC_CONVEX_URL")
  const client = new ConvexHttpClient(url)
  client.setAuth(token)
  return client
}

export function safeErrorMessage(error: unknown, fallback: string) {
  return extractAppErrorKey(error) ?? fallback
}

export function randomCredential(bytes = 32) {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return Buffer.from(values).toString("base64url")
}
