"use client"

import { T } from "@/components/translated-text"
import {
  useAppTranslations,
  useLocalizedHref,
} from "@/i18n/use-app-translations"

import { useEffect, useState } from "react"
import { SignIn, useAuth } from "@clerk/nextjs"
import { LoaderCircle, MailCheck } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"

export function InvitationComplete() {
  const href = useLocalizedHref()
  const t = useAppTranslations()
  const { isLoaded, isSignedIn } = useAuth()
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    let cancelled = false
    void fetch("/api/invitations/complete", { method: "POST" })
      .then(async (response) => {
        const result = (await response.json()) as {
          error?: string
          hubSlug?: string
        }
        if (!response.ok || !result.hubSlug)
          throw new Error(result.error ?? "Could not activate profile")
        if (!cancelled)
          window.location.assign(
            href(`/?hub=${encodeURIComponent(result.hubSlug)}`)
          )
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setError(
            caught instanceof Error
              ? t(caught.message)
              : t("Could not activate profile")
          )
      })
    return () => {
      cancelled = true
    }
  }, [href, isLoaded, isSignedIn, t])

  if (isLoaded && !isSignedIn) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <SignIn forceRedirectUrl={href("/invitation/complete")} />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg shadow-none">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary">
            <MailCheck />
          </span>
          <h1 className="font-heading text-lg font-semibold">
            <T>Opening your workplace</T>
          </h1>
          <CardDescription>
            <T>Your invitation is being connected to the employee profile.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              <T>{error}</T>
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />{" "}
              <T>Activating employee access…</T>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
