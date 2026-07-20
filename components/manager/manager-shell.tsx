"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Files,
  Headphones,
  Home,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react"
import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
  useClerk,
  useOrganization,
} from "@clerk/nextjs"

import { Brand } from "@/components/knowledge-base/brand"
import { HubSetup } from "@/components/manager/hub-setup"
import { useOperations } from "@/components/providers/operations-provider"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type NavigationLink = {
  href: string
  label: string
  icon: LucideIcon
}

type NavigationGroup = {
  label: string
  icon: LucideIcon
  items: NavigationLink[]
}

const navigationItems: Array<NavigationLink | NavigationGroup> = [
  { href: "/manager", label: "Overview", icon: LayoutDashboard },
  { href: "/manager/today", label: "Today", icon: Home },
  {
    label: "Guides",
    icon: BookOpen,
    items: [
      { href: "/manager/guides", label: "Guides", icon: BookOpen },
      { href: "/manager/categories", label: "Guide categories", icon: Tags },
    ],
  },
  { href: "/manager/calendar", label: "Calendar events", icon: CalendarDays },
  { href: "/manager/announcements", label: "Announcements", icon: Megaphone },
  { href: "/manager/documents", label: "Documents", icon: Files },
  { href: "/manager/questions", label: "Common questions", icon: CircleHelp },
  { href: "/manager/help", label: "Help requests", icon: Headphones },
  {
    label: "Employees",
    icon: Users,
    items: [
      { href: "/manager/employees", label: "Employees", icon: Users },
      {
        href: "/manager/access",
        label: "Employee access",
        icon: ShieldCheck,
      },
    ],
  },
  { href: "/manager/settings", label: "Establishment", icon: Building2 },
]

function isActiveLink(pathname: string, href: string) {
  return href === "/manager" ? pathname === href : pathname.startsWith(href)
}

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { hub, hubState, migrateHubToOrganization } = useOperations()
  const { orgId } = useAuth()
  const { organization } = useOrganization()
  const { openCreateOrganization } = useClerk()
  const focusedEditor = pathname.endsWith("/new") || pathname.endsWith("/edit")
  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Brand linked={!focusedEditor} />
            <div className="flex items-center gap-3">
              <OrganizationSwitcher
                hidePersonal={false}
                afterCreateOrganizationUrl="/manager"
                afterSelectOrganizationUrl="/manager"
                afterSelectPersonalUrl="/manager"
              />
              {!focusedEditor && hub && (
                <Link
                  href={`/?hub=${hub.slug}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "tracking-normal normal-case"
                  )}
                >
                  <ArrowLeft /> Employee site
                </Link>
              )}
              <UserButton />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold">Manager area</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {hub
                ? `${hub.name} · Organization administration`
                : "Choose or create a workplace Organization"}
            </p>
          </div>
          {!focusedEditor && (
            <nav
              className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible"
              aria-label="Manager navigation"
            >
              {navigationItems.map((item) => {
                if ("items" in item) {
                  const active = item.items.some(({ href }) =>
                    isActiveLink(pathname, href)
                  )
                  const Icon = item.icon
                  return (
                    <DropdownMenu key={item.label}>
                      <DropdownMenuTrigger
                        className={cn(
                          buttonVariants({
                            variant: active ? "secondary" : "ghost",
                            size: "sm",
                          }),
                          "tracking-normal normal-case"
                        )}
                      >
                        <Icon /> {item.label} <ChevronDown />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {item.items.map((link) => {
                          const ChildIcon = link.icon
                          const childActive = isActiveLink(pathname, link.href)
                          return (
                            <DropdownMenuItem
                              key={link.href}
                              render={<Link href={link.href} />}
                              className={cn(
                                childActive &&
                                  "bg-accent text-accent-foreground"
                              )}
                            >
                              <ChildIcon /> {link.label}
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                }

                const { href, label, icon: Icon } = item
                const active = isActiveLink(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      buttonVariants({
                        variant: active ? "secondary" : "ghost",
                        size: "sm",
                      }),
                      "tracking-normal normal-case"
                    )}
                  >
                    <Icon /> {label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {hubState === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading your hub…
          </p>
        ) : hubState === "auth-error" ? (
          <div role="alert" className="max-w-2xl border bg-background p-6">
            <h2 className="font-semibold">Manager session is not connected</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Clerk signed you in, but Convex could not validate this session.
              Check the Clerk Convex integration and issuer configuration, then
              sign out and back in.
            </p>
          </div>
        ) : hubState === "needs-setup" ? (
          <HubSetup />
        ) : (
          <>
            {hub && !hub.clerkOrganizationId && (
              <div className="mb-8 flex flex-col gap-4 border bg-background p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">
                    Upgrade this workplace to team access
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create its Clerk Organization to add employees and
                    additional managers.
                  </p>
                </div>
                {orgId ? (
                  <button
                    className={buttonVariants({ size: "sm" })}
                    onClick={() =>
                      void migrateHubToOrganization().catch(() => undefined)
                    }
                  >
                    Connect {organization?.name ?? "active Organization"}
                  </button>
                ) : (
                  <button
                    className={buttonVariants({ size: "sm" })}
                    onClick={() =>
                      openCreateOrganization({
                        afterCreateOrganizationUrl: "/manager",
                        skipInvitationScreen: true,
                      })
                    }
                  >
                    Create workplace with Clerk
                  </button>
                )}
              </div>
            )}
            {children}
          </>
        )}
      </main>
    </div>
  )
}
