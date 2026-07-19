"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Files,
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
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      aria-label="Knowledge base navigation"
    >
      <SidebarSection label="Workspace">
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
      </SidebarSection>

      <SidebarSection label="Guide categories">
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
      </SidebarSection>

      <SidebarSection label="Documents">
        <NavLink
          href="/documents"
          label="Document library"
          active={pathname === "/documents"}
        >
          <Files />
        </NavLink>
      </SidebarSection>

      <SidebarSection label="Help and tools">
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
      </SidebarSection>
    </nav>
  )
}

function SidebarSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const contentId = useId()

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        {label}
        <ChevronDown
          className={cn(
            "size-3.5 text-primary transition-transform",
            !open && "-rotate-90"
          )}
        />
      </button>
      <div id={contentId} hidden={!open}>
        {children}
      </div>
    </div>
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
