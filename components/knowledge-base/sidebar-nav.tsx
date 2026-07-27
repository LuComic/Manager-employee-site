"use client"

import { useId, useState } from "react"
import NextLink from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  BookOpen,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Home,
  Megaphone,
  Settings,
} from "lucide-react"

import { ContactButton } from "@/components/knowledge-base/contact-dialog"
import { DocumentResourceIcon } from "@/components/documents/document-card"
import { LocalizedLink as Link } from "@/components/localized-link"
import { useI18n } from "@/components/providers/i18n-provider"
import { useOperations } from "@/components/providers/operations-provider"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CategoryIcon } from "@/lib/category-icons"
import { cn } from "@/lib/utils"
import { localizeHref, locales, stripLocaleFromPathname } from "@/i18n/config"

export function SidebarNav({ onContact }: { onContact?: () => void }) {
  const localizedPathname = usePathname()
  const pathname = stripLocaleFromPathname(localizedPathname)
  const { t, href } = useI18n()
  const { categories, documents, managerAccess } = useOperations()
  const publishedDocuments = documents.filter((document) => document.published)

  return (
    <nav
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      aria-label={t("Knowledge base navigation")}
    >
      <SidebarSection
        label={t("Workspace")}
        href={href("/")}
        active={pathname === "/"}
      >
        <NavLink href={href("/")} label={t("Today")} active={pathname === "/"}>
          <Home />
        </NavLink>
        <NavLink
          href={href("/notifications")}
          label={t("Notifications")}
          active={pathname === "/notifications"}
        >
          <Bell />
        </NavLink>
        <NavLink
          href={href("/guides")}
          label={t("Guides")}
          active={pathname === "/guides" || pathname.startsWith("/guides/")}
        >
          <BookOpen />
        </NavLink>
        <NavLink
          href={href("/calendar")}
          label={t("Calendar")}
          active={pathname.startsWith("/calendar")}
        >
          <CalendarDays />
        </NavLink>
        <NavLink
          href={href("/announcements")}
          label={t("Announcements")}
          active={pathname.startsWith("/announcements")}
        >
          <Megaphone />
        </NavLink>
      </SidebarSection>

      <SidebarSection
        label={t("Guide categories")}
        href={href("/categories")}
        active={pathname.startsWith("/categories")}
      >
        {categories.map((category) => {
          const categoryHref = `/categories/${category.id}`

          return (
            <NavLink
              key={category.id}
              href={href(categoryHref)}
              label={category.label}
              active={pathname === categoryHref}
            >
              <CategoryIcon iconKey={category.iconKey} />
            </NavLink>
          )
        })}
      </SidebarSection>

      <SidebarSection
        label={t("Documents")}
        href={href("/documents")}
        active={pathname.startsWith("/documents")}
      >
        {publishedDocuments.slice(0, 8).map((document) => {
          const documentHref = `/documents/${document.id}`
          return (
            <NavLink
              key={document.id}
              href={href(documentHref)}
              label={document.title}
              active={pathname === documentHref}
            >
              <DocumentResourceIcon resource={document.resource} />
            </NavLink>
          )
        })}
      </SidebarSection>

      <SidebarSection
        label={t("Help and tools")}
        href={href("/questions")}
        active={pathname === "/questions"}
      >
        <LanguageSelector />
        <NavLink
          href={href("/questions")}
          label={t("Common questions")}
          active={pathname === "/questions"}
        >
          <CircleHelp />
        </NavLink>
        {managerAccess && (
          <NavLink
            href={href("/manager")}
            label={t("Manager area")}
            active={false}
          >
            <Settings />
          </NavLink>
        )}
        <Separator className="my-4" />
        <ContactButton
          className="h-10 w-full justify-start px-3"
          onBeforeOpen={onContact}
        />
      </SidebarSection>
    </nav>
  )
}

function LanguageSelector() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { locale, t, setLocalePreference } = useI18n()
  const search = searchParams.toString()

  return (
    <div
      className="mb-1 grid grid-cols-2 gap-1 px-3"
      aria-label={t("Language")}
      role="group"
    >
      {locales.map((option) => (
        <NextLink
          key={option}
          href={`${localizeHref(pathname, option)}${search ? `?${search}` : ""}`}
          hrefLang={option}
          lang={option}
          onClick={() => setLocalePreference(option)}
          aria-current={locale === option ? "true" : undefined}
          className={cn(
            buttonVariants({
              variant: locale === option ? "selected" : "ghost",
            }),
            "h-8 px-2 text-xs tracking-normal normal-case"
          )}
        >
          {option === "et" ? t("Estonian") : t("English")}
        </NextLink>
      ))}
    </div>
  )
}

function SidebarSection({
  label,
  href,
  active,
  children,
}: {
  label: string
  href: string
  active: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const contentId = useId()
  const { t } = useI18n()

  return (
    <div>
      <div className="flex items-center">
        <Link
          href={href}
          className={cn(
            "min-w-0 flex-1 px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30",
            active && "text-primary"
          )}
          aria-current={active ? "page" : undefined}
        >
          {label}
        </Link>
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center text-primary outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30"
          onClick={() => setOpen((current) => !current)}
          aria-label={t(open ? "Collapse {label}" : "Expand {label}", {
            label,
          })}
          aria-expanded={open}
          aria-controls={contentId}
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              !open && "-rotate-90"
            )}
          />
        </button>
      </div>
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
