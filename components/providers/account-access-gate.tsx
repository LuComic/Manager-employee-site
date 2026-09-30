"use client"

import { useEffect, useState } from "react"
import { useAuth, useClerk, UserButton } from "@clerk/nextjs"
import { useAction, useConvexAuth } from "convex/react"
import { LoaderCircle } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { usePathname } from "@/i18n/navigation"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { Button } from "@/components/ui/button"

export function AccountAccessGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  const { sessionId, orgId } = useAuth()
  const clerk = useClerk()
  const pathname = usePathname()
  const t = useAppTranslations()
  const connect = useAction(api.betaClerk.connectAccount)
  const [completedSession, setCompletedSession] = useState<string | null>(null)
  const [failedSession, setFailedSession] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
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
    void connect()
      .then(async (workplaces) => {
        if (cancelled) return
        await clerk.user?.reload()
        if (!orgId && workplaces[0])
          await clerk.setActive({ organization: workplaces[0].organizationId })
        if (!cancelled) setCompletedSession(sessionId)
      })
      .catch(() => {
        if (!cancelled) setFailedSession(sessionId)
      })
    return () => {
      cancelled = true
    }
  }, [
    attempt,
    completedSession,
    connect,
    isAuthenticated,
    orgId,
    sessionId,
    clerk,
    skip,
  ])

  if (skip || !isAuthenticated || completedSession === sessionId)
    return children
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      {failedSession === sessionId ? (
        <>
          <p role="alert">{t("couldNotConnectAccount")}</p>
          <Button
            onClick={() => {
              setFailedSession(null)
              setAttempt((value) => value + 1)
            }}
          >
            {t("tryAgain")}
          </Button>
          <UserButton />
        </>
      ) : (
        <p role="status" className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" />
          {t("openingYourWorkplace")}
        </p>
      )}
    </div>
  )
}
