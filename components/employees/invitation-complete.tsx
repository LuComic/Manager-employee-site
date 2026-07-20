"use client"

import { useEffect, useState } from "react"
import { SignIn, useAuth } from "@clerk/nextjs"
import { LoaderCircle, MailCheck } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function InvitationComplete() {
  const { isLoaded, isSignedIn } = useAuth()
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let cancelled = false
    void fetch("/api/invitations/complete", { method: "POST" })
      .then(async (response) => {
        const result = (await response.json()) as { error?: string; hubSlug?: string }
        if (!response.ok || !result.hubSlug) throw new Error(result.error ?? "Could not activate profile")
        if (!cancelled) window.location.assign(`/?hub=${encodeURIComponent(result.hubSlug)}`)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not activate profile")
      })
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn])

  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <SignIn forceRedirectUrl="/invitation/complete" />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg shadow-none">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary"><MailCheck /></span>
          <CardTitle>Opening your workplace</CardTitle>
          <CardDescription>Your invitation is being connected to the employee profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Activating employee access…</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
