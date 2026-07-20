"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
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
  CardTitle,
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
        <span className="sr-only">Loading hub</span>
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
            <CardTitle>Workplace access removed</CardTitle>
            <CardDescription>
              Your employee profile is deactivated. Choose another workplace or
              contact a manager if this is unexpected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationSwitcher
              hidePersonal={false}
              afterSelectOrganizationUrl="/"
              afterSelectPersonalUrl="/"
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
            <CardTitle>{hub?.name ?? "Private operations hub"}</CardTitle>
            <CardDescription>
              Enter the employee join code. You do not need an account.
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
                <Label htmlFor="join-code">Employee join code</Label>
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
                  That code or private link is invalid, expired, or has been
                  rotated.
                </p>
              )}
              <Button type="submit" className="w-full">
                <KeyRound /> Open hub
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
      {hub?.accessMode === "restricted" && credential && (
        <Button
          variant="outline"
          size="sm"
          className="fixed right-4 bottom-4 z-40 bg-background shadow-sm"
          onClick={leaveHub}
        >
          <LogOut /> Leave hub
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
        <span className="sr-only">Opening workplace</span>
      </main>
    )
  }

  return (
    <main className="min-h-svh bg-muted/40 p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-5xl items-center sm:min-h-[calc(100svh-4rem)]">
        <div className="grid w-full overflow-hidden border bg-background shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-between bg-primary p-8 text-primary-foreground sm:p-12">
            <div>
              <span className="flex size-12 items-center justify-center bg-primary-foreground text-primary">
                <BriefcaseBusiness className="size-6" />
              </span>
              <p className="mt-6 text-sm font-medium text-primary-foreground/75">
                Operations hub
              </p>
              <h1 className="mt-3 max-w-md text-4xl leading-15 font-semibold tracking-tight sm:text-5xl">
                Everything your shift needs, in one place.
              </h1>
              <p className="mt-5 max-w-lg text-primary-foreground/75">
                Open today’s updates, practical guides, announcements, and
                workplace events.
              </p>
            </div>

            <div className="mt-12">
              {isSignedIn ? (
                <div className="space-y-4">
                  <p className="text-sm text-primary-foreground/75">
                    {hasActiveOrganization
                      ? "The selected Organization is not connected to a hub. Choose another workplace."
                      : "Choose a workplace Organization or manage your own hub."}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-10 items-center border border-primary-foreground/30 bg-background px-2 text-foreground">
                      <OrganizationSwitcher
                        hidePersonal={false}
                        afterCreateOrganizationUrl="/manager"
                        afterSelectOrganizationUrl="/"
                        afterSelectPersonalUrl="/"
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
                      <Building2 /> Manager area
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-primary-foreground/75">
                    Have an employee or manager account?
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <SignInButton mode="modal">
                      <Button variant="secondary">
                        <LogIn /> Sign in
                      </Button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <Button className="border border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                        <UserPlus /> Create account
                      </Button>
                    </SignUpButton>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section id="join-workplace" className="scroll-mt-4 p-8 sm:p-12">
            <div className="flex size-11 items-center justify-center bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">
              Join a workplace
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No account is needed. Use the link or workplace ID shared by your
              manager.
            </p>

            <Separator className="my-6" />

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault()
                const entry = parseHubEntry(
                  workplace,
                  employeeCode,
                  window.location.origin
                )
                if (!entry) {
                  setError("Enter a valid workplace link or ID.")
                  return
                }
                window.location.assign(hubEntryHref(entry))
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="workplace-entry">Workplace link or ID</Label>
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
                <Label htmlFor="employee-code">Employee code</Label>
                <Input
                  id="employee-code"
                  value={employeeCode}
                  onChange={(event) => setEmployeeCode(event.target.value)}
                  placeholder="Optional for public workplaces"
                  autoComplete="one-time-code"
                  className="border border-input px-3 font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Restricted workplaces require the employee code. It is kept
                  out of the URL query string.
                </p>
              </div>
              {initialHubSlug && (
                <p role="alert" className="text-sm text-destructive">
                  That workplace could not be found. Check the link or ID and
                  try again.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full">
                Open workplace <ArrowRight />
              </Button>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
