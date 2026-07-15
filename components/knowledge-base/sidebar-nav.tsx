"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CircleHelp, Home } from "lucide-react"

import { ContactButton } from "@/components/knowledge-base/contact-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { categories } from "@/lib/knowledge-base"
import { cn } from "@/lib/utils"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col overflow-y-auto p-4" aria-label="Knowledge base navigation">
      <p className="px-3 py-2 text-sm font-medium text-muted-foreground">Browse</p>
      <NavLink href="/" label="Overview" active={pathname === "/"} onNavigate={onNavigate}>
        <Home />
      </NavLink>
      {categories.map((category) => {
        const Icon = category.icon
        const href = `/categories/${category.id}`

        return (
          <NavLink
            key={category.id}
            href={href}
            label={category.label}
            active={pathname === href}
            onNavigate={onNavigate}
          >
            <Icon />
          </NavLink>
        )
      })}

      <p className="mt-4 px-3 py-2 text-sm font-medium text-muted-foreground">Help</p>
      <NavLink href="/questions" label="Common questions" active={pathname === "/questions"} onNavigate={onNavigate}>
        <CircleHelp />
      </NavLink>
      <Separator className="my-4" />
      <ContactButton className="h-10 w-full justify-start px-3" onBeforeOpen={onNavigate} />
    </nav>
  )
}

function NavLink({
  href,
  label,
  active,
  onNavigate,
  children,
}: {
  href: string
  label: string
  active: boolean
  onNavigate?: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "h-10 w-full justify-start gap-3 px-3 normal-case tracking-normal",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <span className={cn("text-muted-foreground", active && "text-primary")}>{children}</span>
      {label}
    </Link>
  )
}
