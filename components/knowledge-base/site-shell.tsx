"use client"

import { T } from "@/components/translated-text"
import {
  useAppTranslations,
  useLocalizedHref,
} from "@/i18n/use-app-translations"

import { useEffect, useRef, useState } from "react"
import { Menu } from "lucide-react"
import { OrganizationSwitcher, Show, UserButton } from "@clerk/nextjs"

import { AnnouncementTopbar } from "@/components/announcements/announcement-topbar"
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
            <AnnouncementTopbar />
            <header className="sticky top-0 z-20 border-b bg-background/90 px-4 py-2 backdrop-blur sm:px-6 lg:px-8 lg:py-5">
              <div className="mx-auto grid max-w-7xl grid-cols-[auto_auto_1fr] items-center gap-2 sm:flex sm:gap-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label={t("openMenu")}
                >
                  <Menu />
                </Button>
                <div className="lg:hidden">
                  <Brand compact />
                </div>
                <div className="ml-auto flex min-w-0 items-center justify-end gap-1 sm:order-2 sm:shrink-0 sm:gap-2">
                  <Show when="signed-in">
                    <div className="hidden max-w-48 overflow-hidden md:block">
                      <OrganizationSwitcher
                        hidePersonal={false}
                        afterCreateOrganizationUrl={href("/manager")}
                        afterSelectOrganizationUrl={href("/")}
                        afterSelectPersonalUrl={href("/")}
                      />
                    </div>
                  </Show>
                  <ContactButton className="hidden md:flex" />
                  <UserButton />
                  <NotificationButton />
                  <div className="md:hidden">
                    <ContactButton compact />
                  </div>
                </div>
                <div className="col-span-3 min-w-0 sm:order-1 sm:col-span-1 sm:flex-1">
                  <SearchField inputRef={searchRef} />
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
                  <T>todaySInformationAndPracticalGuides</T>
                </SheetDescription>
                <Show when="signed-in">
                  <div className="mt-3 max-w-full overflow-hidden">
                    <OrganizationSwitcher
                      hidePersonal={false}
                      afterCreateOrganizationUrl={href("/manager")}
                      afterSelectOrganizationUrl={href("/")}
                      afterSelectPersonalUrl={href("/")}
                    />
                  </div>
                </Show>
              </SheetHeader>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </ContactProvider>
    </HubAccessGate>
  )
}
