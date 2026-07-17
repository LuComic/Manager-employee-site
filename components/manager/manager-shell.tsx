"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  Tags,
} from "lucide-react"

import { Brand } from "@/components/knowledge-base/brand"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const links = [
  { href: "/manager", label: "Overview", icon: LayoutDashboard },
  { href: "/manager/guides", label: "Guides", icon: BookOpen },
  { href: "/manager/categories", label: "Guide categories", icon: Tags },
  { href: "/manager/calendar", label: "Calendar events", icon: CalendarDays },
  { href: "/manager/announcements", label: "Announcements", icon: Megaphone },
]

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const focusedEditor = pathname.endsWith("/new") || pathname.endsWith("/edit")
  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Brand linked={!focusedEditor} />
            {!focusedEditor && (
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "tracking-normal normal-case"
                )}
              >
                <ArrowLeft /> Employee site
              </Link>
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold">Manager area</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Demo content administration
            </p>
          </div>
          {!focusedEditor && (
            <nav
              className="flex gap-2 overflow-x-auto pb-1"
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
        {children}
      </main>
    </div>
  )
}
