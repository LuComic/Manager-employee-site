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
  Menu,
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type NavigationLink = {
  href: string
  label: string
  icon: LucideIcon
}

const primaryNavigationItems: NavigationLink[] = [
  { href: "/manager", label: "Overview", icon: LayoutDashboard },
  { href: "/manager/today", label: "Today", icon: Home },
]

const guideNavigationItems: NavigationLink[] = [
  { href: "/manager/guides", label: "Guides", icon: BookOpen },
  { href: "/manager/categories", label: "Guide categories", icon: Tags },
]

const moreNavigationGroups: { label: string; items: NavigationLink[] }[] = [
  {
    label: "Content",
    items: [
      {
        href: "/manager/calendar",
        label: "Calendar events",
        icon: CalendarDays,
      },
      {
        href: "/manager/announcements",
        label: "Announcements",
        icon: Megaphone,
      },
      { href: "/manager/documents", label: "Documents", icon: Files },
      {
        href: "/manager/questions",
        label: "Common questions",
        icon: CircleHelp,
      },
    ],
  },
  {
    label: "People and workplace",
    items: [
      { href: "/manager/help", label: "Help requests", icon: Headphones },
      { href: "/manager/employees", label: "Employees", icon: Users },
      {
        href: "/manager/access",
        label: "Employee access",
        icon: ShieldCheck,
      },
      {
        href: "/manager/settings",
        label: "Establishment",
        icon: Building2,
      },
    ],
  },
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Brand linked={!focusedEditor} />
            <div className="ml-auto flex items-center gap-3">
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
            <p className="text-lg font-semibold">Manager area</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hub
                ? `${hub.name} · Workplace administration`
                : "Choose or create a workplace"}
            </p>
          </div>
          {!focusedEditor && (
            <nav
              className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
              aria-label="Manager navigation"
            >
              {primaryNavigationItems.map((item) => {
                const { href, label, icon: Icon } = item
                const active = isActiveLink(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      buttonVariants({
                        variant: active ? "secondary" : "ghost",
                        size: "default",
                      }),
                      "w-full justify-start px-4 text-sm tracking-normal normal-case sm:w-auto"
                    )}
                  >
                    <Icon /> {label}
                  </Link>
                )
              })}
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({
                      variant: guideNavigationItems.some(({ href }) =>
                        isActiveLink(pathname, href)
                      )
                        ? "secondary"
                        : "ghost",
                      size: "default",
                    }),
                    "w-full justify-start px-4 text-sm tracking-normal normal-case sm:w-auto"
                  )}
                >
                  <BookOpen /> Guides <ChevronDown />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {guideNavigationItems.map((link) => {
                    const Icon = link.icon
                    const active = isActiveLink(pathname, link.href)
                    return (
                      <DropdownMenuItem
                        key={link.href}
                        render={<Link href={link.href} />}
                        className={cn(
                          active && "bg-accent text-accent-foreground"
                        )}
                      >
                        <Icon /> {link.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({
                      variant: moreNavigationGroups.some((group) =>
                        group.items.some(({ href }) =>
                          isActiveLink(pathname, href)
                        )
                      )
                        ? "secondary"
                        : "ghost",
                      size: "default",
                    }),
                    "w-full justify-start px-4 text-sm tracking-normal normal-case sm:w-auto"
                  )}
                >
                  <Menu /> More tools <ChevronDown />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  {moreNavigationGroups.map((group, groupIndex) => (
                    <DropdownMenuGroup key={group.label}>
                      {groupIndex > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                      {group.items.map((link) => {
                        const Icon = link.icon
                        const active = isActiveLink(pathname, link.href)
                        return (
                          <DropdownMenuItem
                            key={link.href}
                            render={<Link href={link.href} />}
                            className={cn(
                              active && "bg-accent text-accent-foreground"
                            )}
                          >
                            <Icon /> {link.label}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuGroup>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {hubState === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading your hub…
          </p>
        ) : hubState === "auth-error" ? (
          <div role="alert" className="max-w-2xl border bg-background p-6">
            <h2 className="font-semibold">Manager session is not connected</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You are signed in, but this session could not be validated. Sign
              out and back in, then contact support if the issue continues.
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
                    Enable team access to add employees and additional managers.
                  </p>
                </div>
                {orgId ? (
                  <button
                    className={buttonVariants({ size: "sm" })}
                    onClick={() =>
                      void migrateHubToOrganization().catch(() => undefined)
                    }
                  >
                    Connect {organization?.name ?? "active workplace"}
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
                    Create workplace account
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
