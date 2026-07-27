"use client"

import { T, useI18n } from "@/components/providers/i18n-provider"

import { useEffect, useState } from "react"
import { LocalizedLink as Link } from "@/components/localized-link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  OrganizationSwitcher,
  SignInButton,
  SignUpButton,
  useAuth,
} from "@clerk/nextjs"
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
} from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
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
import { stripLocaleFromPathname } from "@/i18n/config"

export function HubAccessGate({ children }: { children: React.ReactNode }) {
  const { hub, hubSlug, hubState, credential, grantAnonymousAccess, leaveHub } =
    useOperations()
  const { isSignedIn, orgId, orgRole } = useAuth()
  const pathname = stripLocaleFromPathname(usePathname())
  const { href, t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState("")
  const shouldRedirectMissingWorkspace =
    hubState === "not-found" && pathname === "/" && !searchParams.has("hub")

  useEffect(() => {
    if (!shouldRedirectMissingWorkspace) return
    router.replace(
      href(isSignedIn && orgRole === "org:admin" ? "/manager" : "/join")
    )
  }, [href, isSignedIn, orgRole, router, shouldRedirectMissingWorkspace])

  if (hubState === "loading" || shouldRedirectMissingWorkspace) {
    return (
      <div
        className="flex min-h-svh items-center justify-center bg-muted/40"
        role="status"
      >
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <span className="sr-only">
          <T>Loading hub</T>
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
              <T>Workplace access removed</T>
            </h1>
            <CardDescription>
              <T>
                Your employee profile is deactivated. Choose another workplace
                or contact a manager if this is unexpected.
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
              {hub?.name ?? t("Private operations hub")}
            </h1>
            <CardDescription>
              <T>Enter the employee join code. You do not need an account.</T>
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
                  <T>Employee join code</T>
                </Label>
                <Input
                  id="join-code"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  placeholder="XXXX-XXXX"
                  autoComplete="one-time-code"
                  className="border border-input px-3 font-mono uppercase"
                  required
                />
              </div>
              {credential && (
                <p role="alert" className="text-sm text-destructive">
                  <T>
                    That code or private link is invalid, expired, or has been
                    rotated.
                  </T>
                </p>
              )}
              <Button type="submit" className="w-full">
                <KeyRound /> <T>Open hub</T>
              </Button>
            </form>
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
          <LogOut /> <T>Leave hub</T>
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
  const { href, t } = useI18n()
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
    router.replace(href("/"))
  }, [href, router, shouldOpenActiveHub])

  if (shouldOpenActiveHub) {
    return (
      <main
        className="flex min-h-svh items-center justify-center bg-muted/40"
        role="status"
      >
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <span className="sr-only">
          <T>Opening workplace</T>
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
              <span className="flex size-10 items-center justify-center bg-primary-foreground text-primary">
                <BriefcaseBusiness className="size-5" />
              </span>
              <p className="mt-4 text-sm font-medium text-primary-foreground/75">
                <T>Operations hub</T>
              </p>
              <h1 className="mt-2 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
                <T>Everything your shift needs, in one place.</T>
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/75 sm:text-base">
                <T>
                  Open today’s updates, practical guides, announcements, and
                  workplace events.
                </T>
              </p>
            </div>

            <div className="mt-8">
              {isSignedIn ? (
                <div className="space-y-4">
                  <p className="text-sm text-primary-foreground/75">
                    {t(
                      hasActiveOrganization
                        ? "The selected workplace is not connected to a hub. Choose another workplace."
                        : "Choose a workplace or manage your own hub."
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
                      <Building2 /> <T>Manager area</T>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-primary-foreground/75">
                    <T>Have an employee or manager account?</T>
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <SignInButton mode="modal">
                      <Button variant="secondary">
                        <LogIn /> <T>Sign in</T>
                      </Button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <Button className="border border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                        <UserPlus /> <T>Create account</T>
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
              <T>Join a workplace</T>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>
                No account is needed. Use the link or workplace ID shared by
                your manager.
              </T>
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
                  setError(t("Enter a valid workplace link or ID."))
                  return
                }
                window.location.assign(href(hubEntryHref(entry)))
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="workplace-entry">
                  <T>Workplace link or ID</T>
                </Label>
                <Input
                  id="workplace-entry"
                  value={workplace}
                  onChange={(event) => {
                    setWorkplace(event.target.value)
                    setError("")
                  }}
                  placeholder="north-pine or paste the full link"
                  autoComplete="url"
                  className="border border-input px-3"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-code">
                  <T>Employee code</T>
                </Label>
                <Input
                  id="employee-code"
                  value={employeeCode}
                  onChange={(event) => setEmployeeCode(event.target.value)}
                  placeholder="Enter the employee code"
                  autoComplete="one-time-code"
                  className="border border-input px-3 font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  <T>
                    Use the code shared by your manager, or leave this blank
                    when pasting a private join link.
                  </T>
                </p>
              </div>
              {initialHubSlug && (
                <p role="alert" className="text-sm text-destructive">
                  <T>
                    That workplace could not be found. Check the link or ID and
                    try again.
                  </T>
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  <T>{error}</T>
                </p>
              )}
              <Button type="submit" className="w-full">
                <T>Open workplace</T> <ArrowRight />
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
