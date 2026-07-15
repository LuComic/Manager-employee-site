"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Globe2, Languages, Menu } from "lucide-react"

import { Brand } from "@/components/knowledge-base/brand"
import {
  ContactButton,
  ContactProvider,
} from "@/components/knowledge-base/contact-dialog"
import { SearchField } from "@/components/knowledge-base/search-field"
import { SearchResults } from "@/components/knowledge-base/search-results"
import { SidebarNav } from "@/components/knowledge-base/sidebar-nav"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const languages = ["English", "Estonian", "Spanish"] as const

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("")
  const [language, setLanguage] =
    useState<(typeof languages)[number]>("English")
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
    <ContactProvider>
      <div className="min-h-svh bg-muted/40">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar lg:flex lg:flex-col">
          <div className="flex h-20 items-center px-6">
            <Brand onNavigate={() => setQuery("")} />
          </div>
          <SidebarNav onNavigate={() => setQuery("")} />
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
              <Brand compact onNavigate={() => setQuery("")} />
            </div>
            <SearchField
              value={query}
              onChange={setQuery}
              inputRef={searchRef}
            />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden sm:flex"
                    />
                  }
                >
                  <Globe2 /> {language} <ChevronDown />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Choose language</DropdownMenuLabel>
                  {languages.map((item) => (
                    <DropdownMenuItem
                      key={item}
                      onClick={() => setLanguage(item)}
                    >
                      {language === item ? <Check /> : <Languages />} {item}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ContactButton className="hidden sm:flex" />
              <div className="sm:hidden">
                <ContactButton compact />
              </div>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {query.trim() ? (
              <SearchResults query={query} onNavigate={() => setQuery("")} />
            ) : (
              children
            )}
          </main>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-full max-w-sm p-0">
            <SheetHeader className="border-b text-left">
              <SheetTitle className="tracking-normal normal-case">
                <Brand onNavigate={() => setQuery("")} />
              </SheetTitle>
              <SheetDescription>
                Simple guides for a smooth shift.
              </SheetDescription>
            </SheetHeader>
            <SidebarNav
              onNavigate={() => {
                setMobileOpen(false)
                setQuery("")
              }}
            />
          </SheetContent>
        </Sheet>
      </div>
    </ContactProvider>
  )
}
