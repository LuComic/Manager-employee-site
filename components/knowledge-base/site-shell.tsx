"use client"

import { useEffect, useRef, useState } from "react"
import { Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import { OrganizationSwitcher, Show } from "@clerk/nextjs"

import { Brand } from "@/components/knowledge-base/brand"
import {
  ContactButton,
  ContactProvider,
} from "@/components/knowledge-base/contact-dialog"
import { SearchField } from "@/components/knowledge-base/search-field"
import { SearchResults } from "@/components/knowledge-base/search-results"
import { SidebarNav } from "@/components/knowledge-base/sidebar-nav"
import { HubAccessGate } from "@/components/operations/hub-access-gate"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return <SiteShellContent key={pathname}>{children}</SiteShellContent>
}

function SiteShellContent({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("")
  const [mobileOpen, setMobileOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName
      if (
        event.key === "/" &&
        activeTag !== "INPUT" &&
        activeTag !== "TEXTAREA"
      ) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <HubAccessGate>
      <ContactProvider>
        <div className="min-h-svh bg-muted/40">
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:flex lg:flex-col">
            <div className="flex h-20 items-center px-6">
              <Brand />
            </div>
            <SidebarNav />
          </aside>

          <div className="lg:pl-64">
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:h-20 lg:px-8">
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu />
              </Button>
              <div className="lg:hidden">
                <Brand compact />
              </div>
              <SearchField
                value={query}
                onChange={setQuery}
                inputRef={searchRef}
              />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Show when="signed-in">
                  <OrganizationSwitcher
                    hidePersonal={false}
                    afterCreateOrganizationUrl="/manager"
                    afterSelectOrganizationUrl="/"
                    afterSelectPersonalUrl="/"
                  />
                </Show>
                <ContactButton className="hidden sm:flex" />
                <div className="sm:hidden">
                  <ContactButton compact />
                </div>
              </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {query.trim() ? <SearchResults query={query} /> : children}
            </main>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-full max-w-sm p-0">
              <SheetHeader className="border-b text-left">
                <SheetTitle className="tracking-normal normal-case">
                  <Brand />
                </SheetTitle>
                <SheetDescription>
                  Today’s information and practical guides.
                </SheetDescription>
              </SheetHeader>
              <SidebarNav onContact={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </ContactProvider>
    </HubAccessGate>
  )
}
