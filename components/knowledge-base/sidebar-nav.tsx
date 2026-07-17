"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  Home,
  Megaphone,
  Settings,
} from "lucide-react"

import { ContactButton } from "@/components/knowledge-base/contact-dialog"
import { useOperations } from "@/components/providers/operations-provider"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CategoryIcon } from "@/lib/category-icons"
import { cn } from "@/lib/utils"

export function SidebarNav({ onContact }: { onContact?: () => void }) {
  const pathname = usePathname()
  const { categories } = useOperations()

  return (
    <nav
      className="flex flex-1 flex-col overflow-y-auto p-4"
      aria-label="Knowledge base navigation"
    >
      <p className="px-3 py-2 text-sm font-medium text-muted-foreground">
        Workspace
      </p>
      <NavLink href="/" label="Today" active={pathname === "/"}>
        <Home />
      </NavLink>
      <NavLink
        href="/guides"
        label="Guides"
        active={
          pathname === "/guides" ||
          pathname.startsWith("/guides/") ||
          pathname.startsWith("/categories/")
        }
      >
        <BookOpen />
      </NavLink>
      <NavLink
        href="/calendar"
        label="Calendar"
        active={pathname.startsWith("/calendar")}
      >
        <CalendarDays />
      </NavLink>
      <NavLink
        href="/announcements"
        label="Announcements"
        active={pathname.startsWith("/announcements")}
      >
        <Megaphone />
      </NavLink>

      <p className="mt-4 px-3 py-2 text-sm font-medium text-muted-foreground">
        Guide categories
      </p>
      {categories.map((category) => {
        const href = `/categories/${category.id}`

        return (
          <NavLink
            key={category.id}
            href={href}
            label={category.label}
            active={pathname === href}
          >
            <CategoryIcon iconKey={category.iconKey} />
          </NavLink>
        )
      })}

      <p className="mt-4 px-3 py-2 text-sm font-medium text-muted-foreground">
        Help and tools
      </p>
      <NavLink
        href="/questions"
        label="Common questions"
        active={pathname === "/questions"}
      >
        <CircleHelp />
      </NavLink>
      <NavLink href="/manager" label="Manager area" active={false}>
        <Settings />
      </NavLink>
      <Separator className="my-4" />
      <ContactButton
        className="h-10 w-full justify-start px-3"
        onBeforeOpen={onContact}
      />
    </nav>
  )
}

function NavLink({
  href,
  label,
  active,
  children,
}: {
  href: string
  label: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "h-10 w-full justify-start gap-3 px-3 tracking-normal normal-case",
        active && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
    >
      <span className={cn("text-muted-foreground", active && "text-primary")}>
        {children}
      </span>
      {label}
    </Link>
  )
}
