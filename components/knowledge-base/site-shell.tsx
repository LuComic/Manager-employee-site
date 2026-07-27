"use client"

import { T } from "@/components/translated-text"
import {
  useAppTranslations,
  useLocalizedHref,
} from "@/i18n/use-app-translations"

import { useEffect, useRef, useState } from "react"
import { Menu } from "lucide-react"
import { OrganizationSwitcher, Show, UserButton } from "@clerk/nextjs"

import { Brand } from "@/components/knowledge-base/brand"
import {
  ContactButton,
  ContactProvider,
} from "@/components/knowledge-base/contact-dialog"
import { SearchField } from "@/components/knowledge-base/search-field"
import { SidebarNav } from "@/components/knowledge-base/sidebar-nav"
import { NotificationButton } from "@/components/notifications/notification-center"
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
  const href = useLocalizedHref()
  const t = useAppTranslations()
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
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:h-20 lg:px-8">
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label={t("Open menu")}
              >
                <Menu />
              </Button>
              <div className="lg:hidden">
                <Brand compact />
              </div>
              <SearchField inputRef={searchRef} />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Show when="signed-in">
                  <OrganizationSwitcher
                    hidePersonal={false}
                    afterCreateOrganizationUrl={href("/manager")}
                    afterSelectOrganizationUrl={href("/")}
                    afterSelectPersonalUrl={href("/")}
                  />
                </Show>
                <ContactButton className="hidden sm:flex" />
                <UserButton />
                <NotificationButton />
                <div className="sm:hidden">
                  <ContactButton compact />
                </div>
              </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="w-full max-w-sm p-0">
              <SheetHeader className="border-b text-left">
                <SheetTitle className="tracking-normal normal-case">
                  <Brand />
                </SheetTitle>
                <SheetDescription>
                  <T>Today’s information and practical guides.</T>
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
