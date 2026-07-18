"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  Headphones,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Tags,
} from "lucide-react"
import { UserButton } from "@clerk/nextjs"

import { Brand } from "@/components/knowledge-base/brand"
import { HubSetup } from "@/components/manager/hub-setup"
import { useOperations } from "@/components/providers/operations-provider"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const links = [
  { href: "/manager", label: "Overview", icon: LayoutDashboard },
  { href: "/manager/guides", label: "Guides", icon: BookOpen },
  { href: "/manager/categories", label: "Guide categories", icon: Tags },
  { href: "/manager/calendar", label: "Calendar events", icon: CalendarDays },
  { href: "/manager/announcements", label: "Announcements", icon: Megaphone },
  { href: "/manager/questions", label: "Common questions", icon: CircleHelp },
  { href: "/manager/help", label: "Help requests", icon: Headphones },
  { href: "/manager/access", label: "Employee access", icon: ShieldCheck },
  { href: "/manager/settings", label: "Establishment", icon: Building2 },
]

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { hub, hubState } = useOperations()
  const focusedEditor = pathname.endsWith("/new") || pathname.endsWith("/edit")
  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Brand linked={!focusedEditor} />
            <div className="flex items-center gap-3">
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
                ? `${hub.name} · owner administration`
                : "Owner administration"}
            </p>
          </div>
          {!focusedEditor && (
            <nav
              className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible"
              aria-label="Manager navigation"
            >
              {links.map(({ href, label, icon: Icon }) => {
                const active =
                  href === "/manager"
                    ? pathname === href
                    : pathname.startsWith(href)
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
          children
        )}
      </main>
    </div>
  )
}
