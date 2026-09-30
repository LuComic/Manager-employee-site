"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth, useClerk } from "@clerk/nextjs"
import { useAction, useConvexAuth } from "convex/react"
import { LoaderCircle } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { usePathname } from "@/i18n/navigation"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { Button } from "@/components/ui/button"

export function AccountAccessGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  const { sessionId } = useAuth()
  const clerk = useClerk()
  const pathname = usePathname()
  const t = useAppTranslations()
  const connect = useAction(api.betaClerk.connectAccount)
  const [completedSession, setCompletedSession] = useState<string | null>(null)
  const [failedSession, setFailedSession] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const request = useRef<{
    sessionId: string
    attempt: number
    promise: ReturnType<typeof connect>
  } | null>(null)
  const skip =
    pathname.startsWith("/sign-") || pathname.startsWith("/invitation/")

  useEffect(() => {
    if (
      skip ||
      !isAuthenticated ||
      !sessionId ||
      completedSession === sessionId
    )
      return
    let cancelled = false
    // Reuse the request if React replays this effect. Organization activation
    // must not trigger another membership reconciliation for the same session.
    if (
      request.current?.sessionId !== sessionId ||
      request.current.attempt !== attempt
    )
      request.current = { sessionId, attempt, promise: connect({}) }
    const isCurrentSession = () => !cancelled && clerk.session?.id === sessionId
    void request.current.promise
      .then(async (workplaces) => {
        if (!isCurrentSession()) return
        await clerk.user?.reload()
        if (!isCurrentSession()) return
        // Read current Clerk state after the request: a user may have selected
        // another workplace while it was pending. Respect that selection.
        if (!clerk.session?.lastActiveOrganizationId && workplaces[0])
          await clerk.setActive({ organization: workplaces[0].organizationId })
        if (isCurrentSession()) setCompletedSession(sessionId)
      })
      .catch((error: unknown) => {
        if (!isCurrentSession()) return
        console.error("Workplace account connection failed", error)
        setFailedSession(sessionId)
      })
    return () => {
      cancelled = true
    }
  }, [
    attempt,
    completedSession,
    connect,
    isAuthenticated,
    sessionId,
    clerk,
    skip,
  ])

  const pending =
    !skip && isAuthenticated && sessionId && completedSession !== sessionId
  return (
    <>
      {pending && (
        <div className="border-b bg-muted/40 px-4 py-3 text-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            {failedSession === sessionId ? (
              <>
                <p role="alert">{t("couldNotConnectAccount")}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFailedSession(null)
                    setAttempt((value) => value + 1)
                  }}
                >
                  {t("tryAgain")}
                </Button>
              </>
            ) : (
              <p role="status" className="flex items-center gap-2">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                {t("connectingYourWorkplace")}
              </p>
            )}
          </div>
        </div>
      )}
      {/* Convex authorization remains authoritative; synchronization must never
          replace an existing workplace, invitation, or guest page. */}
      {children}
    </>
  )
}
