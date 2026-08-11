"use client"

import { T } from "@/components/translated-text"
import {
  useAppTranslations,
  useLocalizedHref,
} from "@/i18n/use-app-translations"

import { Link, usePathname } from "@/i18n/navigation"
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FilePenLine,
  Files,
  Headphones,
  History,
  Home,
  LayoutDashboard,
  Menu,
  Megaphone,
  Plug,
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
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { AppMessageKey } from "@/i18n/messages"
import { cn } from "@/lib/utils"
import {
  firstWorkerManagerPath,
  type WorkerEditableSection,
} from "@/lib/worker-editing"

type NavigationLink = {
  href: string
  label: AppMessageKey
  icon: LucideIcon
  managerOnly?: boolean
}

const primaryNavigationItems: NavigationLink[] = [
  { href: "/manager", label: "overview", icon: LayoutDashboard },
  { href: "/manager/today", label: "today", icon: Home },
]

const guideNavigationItem: NavigationLink = {
  href: "/manager/guides",
  label: "guides",
  icon: BookOpen,
}

const moreNavigationGroups: {
  label: AppMessageKey
  items: NavigationLink[]
}[] = [
  {
    label: "content",
    items: [
      { href: "/manager/categories", label: "categories", icon: Tags },
      {
        href: "/manager/calendar",
        label: "calendarEvents",
        icon: CalendarDays,
      },
      {
        href: "/manager/announcements",
        label: "announcements",
        icon: Megaphone,
      },
      { href: "/manager/documents", label: "documents", icon: Files },
      {
        href: "/manager/questions",
        label: "commonQuestions",
        icon: CircleHelp,
      },
      { href: "/manager/drafts", label: "drafts", icon: FilePenLine },
      {
        href: "/manager/logs",
        label: "activityLogs",
        icon: History,
        managerOnly: true,
      },
    ],
  },
  {
    label: "peopleAndWorkplace",
    items: [
      { href: "/manager/help", label: "helpRequests", icon: Headphones },
      { href: "/manager/employees", label: "employees", icon: Users },
      {
        href: "/manager/access",
        label: "employeeAccess",
        icon: ShieldCheck,
      },
      {
        href: "/manager/settings",
        label: "establishment",
        icon: Building2,
      },
      {
        href: "/manager/apps",
        label: "thirdPartyApps",
        icon: Plug,
      },
    ],
  },
]

function isActiveLink(pathname: string, href: string) {
  return href === "/manager" ? pathname === href : pathname.startsWith(href)
}

function sectionForManagerPath(pathname: string): WorkerEditableSection | null {
  if (pathname.startsWith("/manager/guides")) return "guides"
  if (pathname.startsWith("/manager/calendar")) return "events"
  if (pathname.startsWith("/manager/announcements")) return "announcements"
  if (pathname.startsWith("/manager/documents")) return "documents"
  if (pathname.startsWith("/manager/questions")) return "faqs"
  return null
}

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const href = useLocalizedHref()
  const t = useAppTranslations()
  const { hub, hubState, managerAccess } = useOperations()
  const focusedEditor = pathname.endsWith("/new") || pathname.endsWith("/edit")
  const workerSection = sectionForManagerPath(pathname)
  const workerLandingPath = firstWorkerManagerPath(hub?.workersCanEdit)
  const workerRouteAllowed = Boolean(
    workerSection && hub?.workersCanEdit[workerSection]
  )
  const visibleNavigationItems =
    managerAccess === "viewer"
      ? hub?.workersCanEdit.guides
        ? [guideNavigationItem]
        : []
      : [...primaryNavigationItems, guideNavigationItem]
  const visibleMoreNavigationGroups =
    managerAccess === "viewer"
      ? moreNavigationGroups
          .filter((group) => group.label === "content")
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
              const section = sectionForManagerPath(item.href)
              return Boolean(section && hub?.workersCanEdit[section])
            }),
          }))
          .filter((group) => group.items.length)
      : managerAccess === "owner"
        ? moreNavigationGroups
        : moreNavigationGroups
            .filter((group) => group.label === "content")
            .map((group) => ({
              ...group,
              items:
                managerAccess === "manager"
                  ? group.items
                  : group.items.filter((item) => !item.managerOnly),
            }))
  const contentRoute =
    pathname === "/manager" ||
    pathname.startsWith("/manager/today") ||
    pathname.startsWith("/manager/guides") ||
    pathname.startsWith("/manager/categories") ||
    pathname.startsWith("/manager/calendar") ||
    pathname.startsWith("/manager/announcements") ||
    pathname.startsWith("/manager/documents") ||
    pathname.startsWith("/manager/questions") ||
    pathname.startsWith("/manager/drafts") ||
    pathname.startsWith("/manager/logs")
  const managerOnlyRoute = pathname.startsWith("/manager/logs")
  const routeAllowed =
    managerAccess === "owner" ||
    (managerAccess === "manager" && contentRoute) ||
    (managerAccess === "editor" &&
      contentRoute &&
      !managerOnlyRoute &&
      (!pathname.endsWith("/new") || workerRouteAllowed)) ||
    (managerAccess === "viewer" && workerRouteAllowed)
  return (
    <div className="min-h-svh bg-muted/40">
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur sm:static sm:z-auto sm:border-b-0 sm:bg-background sm:backdrop-blur-none">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:pt-4 sm:pb-0 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <Brand linked={!focusedEditor} />
              <div className="flex items-center gap-1 sm:hidden">
                <UserButton />
                {hub && managerAccess && (
                  <NotificationButton manager={managerAccess === "owner"} />
                )}
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 sm:ml-auto sm:justify-end sm:gap-3">
              {!focusedEditor && hub && (
                <>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    nativeButton={false}
                    className="size-9 min-h-0 sm:hidden"
                    render={
                      <Link
                        href={`/?hub=${hub.slug}`}
                        aria-label={t("employeeSite")}
                        title={t("employeeSite")}
                      />
                    }
                  >
                    <ArrowLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    className="hidden sm:inline-flex"
                    render={<Link href={`/?hub=${hub.slug}`} />}
                  >
                    <ArrowLeft />
                    <T>employeeSite</T>
                  </Button>
                </>
              )}
              <div className="min-w-0 flex-1 overflow-hidden sm:max-w-64 sm:flex-none">
                <OrganizationSwitcher
                  hidePersonal={false}
                  afterCreateOrganizationUrl={href("/manager")}
                  afterSelectOrganizationUrl={href("/manager")}
                  afterSelectPersonalUrl={href("/manager")}
                />
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <UserButton />
                {hub && managerAccess && (
                  <NotificationButton manager={managerAccess === "owner"} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-lg font-semibold">
              {t(
                managerAccess === "owner"
                  ? "managerArea"
                  : managerAccess === "manager"
                    ? "contentManagerArea"
                    : managerAccess === "editor"
                      ? "contentEditorArea"
                      : "workerContentArea"
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hub
                ? t("workplaceAdministrationTitle", { name: hub.name })
                : t("chooseOrCreateAWorkplace")}
            </p>
          </div>
          {!focusedEditor && (
            <nav
              className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:gap-2"
              aria-label={t("managerNavigation")}
            >
              {visibleNavigationItems.map((item) => {
                const { href, label, icon: Icon } = item
                const active = isActiveLink(pathname, href)
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-label={t(label)}
                    className={cn(
                      buttonVariants({
                        variant: active ? "secondary" : "ghost",
                        size: "sm",
                      }),
                      "w-full min-w-0 justify-center gap-2 px-2 text-sm tracking-normal normal-case sm:w-auto sm:px-3"
                    )}
                  >
                    <Icon />
                    <span className="hidden sm:inline">
                      <T>{label}</T>
                    </span>
                  </Link>
                )
              })}
              {visibleMoreNavigationGroups.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t("moreTools")}
                    className={cn(
                      buttonVariants({
                        variant: visibleMoreNavigationGroups.some((group) =>
                          group.items.some(({ href }) =>
                            isActiveLink(pathname, href)
                          )
                        )
                          ? "secondary"
                          : "ghost",
                        size: "sm",
                      }),
                      "w-full min-w-0 justify-center px-2 text-sm tracking-normal normal-case sm:w-auto sm:px-3"
                    )}
                  >
                    <Menu />
                    <span className="hidden sm:inline">
                      <T>moreTools</T>
                    </span>
                    <ChevronDown className="hidden sm:block" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    {visibleMoreNavigationGroups.map((group, groupIndex) => (
                      <DropdownMenuGroup key={group.label}>
                        {groupIndex > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel>
                          <T>{group.label}</T>
                        </DropdownMenuLabel>
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
                              <Icon /> <T>{link.label}</T>
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuGroup>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {hubState === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            <T>loadingYourHub</T>
          </p>
        ) : hubState === "auth-error" ? (
          <div role="alert" className="max-w-2xl border bg-background p-6">
            <h2 className="font-semibold">
              <T>managerSessionIsNotConnected</T>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>signedButSessionNotValidatedSignOutError</T>
            </p>
          </div>
        ) : hubState === "forbidden" ? (
          <div role="alert" className="max-w-2xl border bg-background p-6">
            <h2 className="font-semibold">
              <T>managerAccessIsNotEnabled</T>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>employeeProfileViewWorkplaceButNotEditingMessage</T>
            </p>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 tracking-normal normal-case"
              )}
            >
              <T>openEmployeeSite</T>
            </Link>
          </div>
        ) : hubState === "needs-setup" ? (
          <HubSetup />
        ) : !routeAllowed ? (
          <div role="alert" className="max-w-2xl border bg-background p-6">
            <h2 className="font-semibold">
              <T>managerAccessRequired</T>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <T>contentRoleNotIncludeEmployeeAdministrationWorkplaceMessage</T>
            </p>
            <Link
              href={
                managerAccess === "viewer"
                  ? (workerLandingPath ?? "/")
                  : "/manager"
              }
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "mt-4 tracking-normal normal-case"
              )}
            >
              <T>backToContent</T>
            </Link>
          </div>
        ) : (
          <>{children}</>
        )}
      </main>
    </div>
  )
}
