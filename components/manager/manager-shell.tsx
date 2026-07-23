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
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"

import { Brand } from "@/components/knowledge-base/brand"
import { HubSetup } from "@/components/manager/hub-setup"
import { NotificationButton } from "@/components/notifications/notification-center"
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
  const { hub, hubState, managerAccess } = useOperations()
  const focusedEditor = pathname.endsWith("/new") || pathname.endsWith("/edit")
  const visibleMoreNavigationGroups =
    managerAccess === "owner"
      ? moreNavigationGroups
      : moreNavigationGroups.filter((group) => group.label === "Content")
  const contentRoute =
    pathname === "/manager" ||
    pathname.startsWith("/manager/today") ||
    pathname.startsWith("/manager/guides") ||
    pathname.startsWith("/manager/categories") ||
    pathname.startsWith("/manager/calendar") ||
    pathname.startsWith("/manager/announcements") ||
    pathname.startsWith("/manager/documents") ||
    pathname.startsWith("/manager/questions")
  const routeAllowed =
    managerAccess === "owner" ||
    (contentRoute &&
      (managerAccess === "manager" || !pathname.endsWith("/new")))
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
              {hub && managerAccess === "owner" && (
                <NotificationButton manager />
              )}
            </div>
          </div>
          <div>
            <p className="text-lg font-semibold">
              {managerAccess === "owner"
                ? "Manager area"
                : managerAccess === "manager"
                  ? "Content manager area"
                  : "Content editor area"}
            </p>
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
                      variant: visibleMoreNavigationGroups.some((group) =>
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
                  {visibleMoreNavigationGroups.map((group, groupIndex) => (
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
        ) : hubState === "forbidden" ? (
          <div role="alert" className="max-w-2xl border bg-background p-6">
            <h2 className="font-semibold">Manager access is not enabled</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your employee profile can view the workplace, but it does not have
              editing or manager access.
            </p>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 tracking-normal normal-case"
              )}
            >
              Open employee site
            </Link>
          </div>
        ) : hubState === "needs-setup" ? (
          <HubSetup />
        ) : !routeAllowed ? (
          <div role="alert" className="max-w-2xl border bg-background p-6">
            <h2 className="font-semibold">Manager access required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your content role does not include employee administration,
              workplace settings, access controls, or this page.
            </p>
            <Link
              href="/manager"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 tracking-normal normal-case"
              )}
            >
              Back to content
            </Link>
          </div>
        ) : (
          <>{children}</>
        )}
      </main>
    </div>
  )
}
