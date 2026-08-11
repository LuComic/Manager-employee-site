"use client"

import { T } from "@/components/translated-text"
import {
  useAppTranslations,
  useLocalizedHref,
} from "@/i18n/use-app-translations"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Link, usePathname, useRouter } from "@/i18n/navigation"
import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  useAuth,
} from "@clerk/nextjs"
import {
  ArrowRight,
  Building2,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
} from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { useOperations } from "@/components/providers/operations-provider"
import { SITE_NAME } from "@/lib/branding"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { hubEntryHref, parseHubEntry } from "@/lib/hub-entry"

export function HubAccessGate({ children }: { children: React.ReactNode }) {
  const { hub, hubSlug, hubState, credential, grantAnonymousAccess, leaveHub } =
    useOperations()
  const { isSignedIn, orgId, orgRole } = useAuth()
  const pathname = usePathname()
  const href = useLocalizedHref()
  const t = useAppTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const shouldRedirectMissingWorkspace =
    hubState === "not-found" && pathname === "/" && !searchParams.has("hub")

  useEffect(() => {
    if (!shouldRedirectMissingWorkspace) return
    router.replace(isSignedIn && orgRole === "org:admin" ? "/manager" : "/join")
  }, [isSignedIn, orgRole, router, shouldRedirectMissingWorkspace])

  if (hubState === "loading" || shouldRedirectMissingWorkspace) {
    return (
      <div
        className="flex min-h-svh items-center justify-center bg-muted/40"
        role="status"
      >
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <span className="sr-only">
          <T>loadingHub</T>
        </span>
      </div>
    )
  }

  if (hubState === "not-found") {
    return (
      <HubEntryScreen
        initialHubSlug={hubSlug}
        isSignedIn={Boolean(isSignedIn)}
        hasActiveOrganization={Boolean(orgId)}
      />
    )
  }

  if (hubState === "deactivated") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader>
            <h1 className="font-heading text-lg font-semibold">
              <T>workplaceAccessRemoved</T>
            </h1>
            <CardDescription>
              <T>
                employeeProfileDeactivatedChooseWorkplaceContactManagerMessage
              </T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationSwitcher
              hidePersonal={false}
              afterSelectOrganizationUrl={href("/")}
              afterSelectPersonalUrl={href("/")}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (hubState === "restricted") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader>
            <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary">
              <ShieldCheck />
            </span>
            <h1 className="font-heading text-lg font-semibold">
              {hub?.name ?? t("privateWorkplace")}
            </h1>
            <CardDescription>
              <T>enterEmployeeJoinCodeNotNeedAccount</T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (code.trim()) grantAnonymousAccess(code)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="join-code">
                  <T>employeeJoinCode</T>
                </Label>
                <Input
                  id="join-code"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  placeholder={t("employeeCodeExample")}
                  autoComplete="one-time-code"
                  className="border border-input px-3 font-mono uppercase"
                  required
                />
              </div>
              {credential && (
                <p role="alert" className="text-sm text-destructive">
                  <T>codePrivateLinkInvalidExpiredRotated</T>
                </p>
              )}
              <Button type="submit" className="w-full">
                <KeyRound /> <T>openHub</T>
              </Button>
            </form>

            {!isSignedIn && (
              <div className="mt-6 space-y-4 border-t pt-6">
                <p className="text-sm text-muted-foreground">
                  <T>haveAnEmployeeOrManagerAccount</T>
                </p>
                <SignInButton mode="modal" forceRedirectUrl={href("/")}>
                  <Button type="button" variant="outline" className="w-full">
                    <LogIn /> <T>signIn</T>
                  </Button>
                </SignInButton>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {children}
      {credential && (
        <Button
          variant="outline"
          size="sm"
          className="fixed right-4 bottom-4 z-40 bg-background shadow-sm"
          onClick={leaveHub}
        >
          <LogOut /> <T>leaveHub</T>
        </Button>
      )}
    </>
  )
}

export function HubEntryScreen({
  initialHubSlug,
  isSignedIn: initialIsSignedIn,
  hasActiveOrganization: initialHasActiveOrganization,
}: {
  initialHubSlug: string
  isSignedIn: boolean
  hasActiveOrganization: boolean
}) {
  const { hub, hubState } = useOperations()
  const {
    isLoaded: isAuthLoaded,
    isSignedIn: liveIsSignedIn,
    orgId,
  } = useAuth()
  const router = useRouter()
  const href = useLocalizedHref()
  const t = useAppTranslations()
  const [workplace, setWorkplace] = useState(initialHubSlug)
  const [employeeCode, setEmployeeCode] = useState("")
  const [error, setError] = useState("")
  const isSignedIn = isAuthLoaded ? Boolean(liveIsSignedIn) : initialIsSignedIn
  const hasActiveOrganization = isAuthLoaded
    ? Boolean(orgId)
    : initialHasActiveOrganization
  const shouldOpenActiveHub =
    isSignedIn && hasActiveOrganization && hubState === "ready" && Boolean(hub)

  useEffect(() => {
    if (!shouldOpenActiveHub) return
    router.replace("/")
  }, [router, shouldOpenActiveHub])

  if (shouldOpenActiveHub) {
    return (
      <main
        className="flex min-h-svh items-center justify-center bg-muted/40"
        role="status"
      >
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <span className="sr-only">
          <T>openingWorkplace</T>
        </span>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-muted/40 p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-5xl items-center sm:min-h-[calc(100svh-3rem)]">
        <div className="grid w-full overflow-hidden border bg-background shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-between bg-primary p-6 text-primary-foreground sm:p-8">
            <div>
              <BrandMark className="size-10" />
              <p className="mt-4 text-sm font-medium text-primary-foreground/75">
                {SITE_NAME}
              </p>
              <h1 className="mt-2 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
                <T>everythingShiftNeedsOnePlace</T>
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/75 sm:text-base">
                <T>openTodaySUpdatesPracticalGuidesAnnouncementsMessage</T>
              </p>
            </div>

            <div className="mt-8">
              {isSignedIn ? (
                <div className="space-y-4">
                  <p className="text-sm text-primary-foreground/75">
                    {t(
                      hasActiveOrganization
                        ? "selectedWorkplaceNotConnectedHubChooseWorkplace"
                        : "chooseWorkplaceManageOwnHub"
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-10 items-center border border-primary-foreground/30 bg-background px-2 text-foreground">
                      <OrganizationSwitcher
                        hidePersonal={false}
                        afterCreateOrganizationUrl={href("/manager")}
                        afterSelectOrganizationUrl={href("/")}
                        afterSelectPersonalUrl={href("/")}
                        appearance={{
                          elements: {
                            organizationSwitcherTrigger:
                              "rounded-none !text-foreground",
                            organizationPreviewMainIdentifier:
                              "!text-foreground",
                            organizationPreviewSecondaryIdentifier:
                              "!text-muted-foreground",
                            organizationSwitcherTriggerIcon: "!text-foreground",
                          },
                        }}
                      />
                    </div>
                    <Link
                      href="/manager"
                      className={buttonVariants({
                        variant: "secondary",
                        className:
                          "h-10 transform-none transition-colors hover:transform-none active:transform-none",
                      })}
                    >
                      <Building2 data-icon="inline-start" /> <T>managerArea</T>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-primary-foreground/75">
                    <T>haveAnEmployeeOrManagerAccount</T>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <SignInButton mode="modal">
                      <Button variant="secondary">
                        <LogIn /> <T>signIn</T>
                      </Button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <Button className="border border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                        <UserPlus /> <T>createAccount</T>
                      </Button>
                    </SignUpButton>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section id="join-workplace" className="scroll-mt-4 p-6 sm:p-8">
            <div className="flex size-10 items-center justify-center bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">
              <T>joinAWorkplace</T>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>noAccountNeededUseLinkWorkplaceidMessage</T>
            </p>

            <Separator className="my-4" />

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                const entry = parseHubEntry(
                  workplace,
                  employeeCode,
                  window.location.origin
                )
                if (!entry) {
                  setError("enterValidWorkplaceLinkid")
                  return
                }
                window.location.assign(href(hubEntryHref(entry)))
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="workplace-entry">
                  <T>workplaceLinkOrid</T>
                </Label>
                <Input
                  id="workplace-entry"
                  value={workplace}
                  onChange={(event) => {
                    setWorkplace(event.target.value)
                    setError("")
                  }}
                  placeholder={t("workplaceIdOrPasteFullLink")}
                  autoComplete="url"
                  className="border border-input px-3"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-code">
                  <T>employeeCode</T>
                </Label>
                <Input
                  id="employee-code"
                  value={employeeCode}
                  onChange={(event) => setEmployeeCode(event.target.value)}
                  placeholder={t("enterTheEmployeeCode")}
                  autoComplete="one-time-code"
                  className="border border-input px-3 font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  <T>useCodeSharedManagerLeaveBlankPastingMessage</T>
                </p>
              </div>
              {initialHubSlug && (
                <p role="alert" className="text-sm text-destructive">
                  <T>workplaceNotFoundCheckLinkidTryError</T>
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  <T>{error}</T>
                </p>
              )}
              <Button type="submit" className="w-full">
                <T>openWorkplace</T> <ArrowRight />
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
