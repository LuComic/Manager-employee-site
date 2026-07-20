"use client"

import { useEffect, useState } from "react"
import { SignInButton, useAuth, useOrganizationList, useSession } from "@clerk/nextjs"
import { ConvexHttpClient } from "convex/browser"
import { useQuery } from "convex/react"
import { KeyRound, LoaderCircle } from "lucide-react"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const storageKey = "operations-hub:employee-claim"

export function ClaimPage() {
  const { isLoaded, isSignedIn } = useAuth()
  const { setActive } = useOrganizationList()
  const { session } = useSession()
  const [credential] = useState(() => {
    if (typeof window === "undefined") return ""
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    return fragment.get("claim")?.trim() || sessionStorage.getItem(storageKey) || ""
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [now] = useState(() => Date.now())

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const incoming = fragment.get("claim")?.trim()
    if (incoming) {
      sessionStorage.setItem(storageKey, incoming)
      window.history.replaceState(null, "", "/claim")
    }
  }, [])

  const preview = useQuery(
    api.employees.previewClaim,
    credential ? { credential, now } : "skip"
  )

  async function complete() {
    if (!credential) return
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/claims/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      })
      const result = (await response.json()) as {
        error?: string
        organizationId?: string
        hubSlug?: string
      }
      if (!response.ok || !result.organizationId || !result.hubSlug) {
        throw new Error(result.error ?? "Could not claim this profile")
      }
      await setActive?.({ organization: result.organizationId })
      const token = await session?.getToken({
        organizationId: result.organizationId,
        skipCache: true,
      })
      if (!token) throw new Error("Could not create an Organization session")
      const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
      convex.setAuth(token)
      await convex.mutation(api.employees.completeClaim, { credential })
      sessionStorage.removeItem(storageKey)
      window.location.assign(`/?hub=${encodeURIComponent(result.hubSlug)}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not claim this profile")
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg shadow-none">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary">
            <KeyRound />
          </span>
          <CardTitle>Claim your employee profile</CardTitle>
          <CardDescription>
            This personal link connects your own Clerk account to one workplace profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!credential || preview === undefined || !isLoaded ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Checking claim link…
            </p>
          ) : preview.kind === "invalid" ? (
            <p role="alert" className="text-sm text-destructive">
              This claim link is invalid, expired, revoked, or already used.
            </p>
          ) : (
            <>
              <div className="border p-4 text-sm">
                <p className="font-semibold">{preview.employeeDisplayName}</p>
                <p className="mt-1 text-muted-foreground">{preview.workplaceName}</p>
              </div>
              {isSignedIn ? (
                <Button className="w-full" disabled={pending} onClick={() => void complete()}>
                  {pending && <LoaderCircle className="animate-spin" />}
                  Join workplace and claim profile
                </Button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/claim">
                  <Button className="w-full">Sign in to continue</Button>
                </SignInButton>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
