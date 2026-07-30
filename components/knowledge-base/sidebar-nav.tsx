"use client"

import { useId, useState } from "react"
import { useLocale } from "next-intl"
import { useSearchParams } from "next/navigation"
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
import { useOperations } from "@/components/providers/operations-provider"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getPathname, Link, usePathname } from "@/i18n/navigation"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { CategoryIcon } from "@/lib/category-icons"
import { cn } from "@/lib/utils"

export function SidebarNav({ onContact }: { onContact?: () => void }) {
  const pathname = usePathname()
  const t = useAppTranslations()
  const { categories, documents, hub, managerAccess } = useOperations()
  const publishedDocuments = documents.filter((document) => document.published)
  const managerHref =
    managerAccess === "viewer"
      ? hub?.workersCanEdit.guides
        ? "/manager/guides"
        : hub?.workersCanEdit.events
          ? "/manager/calendar"
          : hub?.workersCanEdit.announcements
            ? "/manager/announcements"
            : hub?.workersCanEdit.documents
              ? "/manager/documents"
              : "/manager/questions"
      : "/manager"

  return (
    <nav
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      aria-label={t("knowledgeBaseNavigation")}
    >
      <SidebarSection label={t("workspace")} href="/" active={pathname === "/"}>
        <NavLink href="/" label={t("today")} active={pathname === "/"}>
          <Home />
        </NavLink>
        <NavLink
          href="/notifications"
          label={t("notifications")}
          active={pathname === "/notifications"}
        >
          <Bell />
        </NavLink>
        <NavLink
          href="/guides"
          label={t("guides")}
          active={pathname === "/guides" || pathname.startsWith("/guides/")}
        >
          <BookOpen />
        </NavLink>
        <NavLink
          href="/calendar"
          label={t("calendar")}
          active={pathname.startsWith("/calendar")}
        >
          <CalendarDays />
        </NavLink>
        <NavLink
          href="/announcements"
          label={t("announcements")}
          active={pathname.startsWith("/announcements")}
        >
          <Megaphone />
        </NavLink>
      </SidebarSection>

      <SidebarSection
        label={t("guideCategories")}
        href="/categories"
        active={pathname.startsWith("/categories")}
      >
        {categories.map((category) => {
          const categoryHref = `/categories/${category.id}`

          return (
            <NavLink
              key={category.id}
              href={categoryHref}
              label={category.label}
              active={pathname === categoryHref}
            >
              <CategoryIcon iconKey={category.iconKey} />
            </NavLink>
          )
        })}
      </SidebarSection>

      <SidebarSection
        label={t("documents")}
        href="/documents"
        active={pathname.startsWith("/documents")}
      >
        {publishedDocuments.slice(0, 8).map((document) => {
          const documentHref = `/documents/${document.id}`
          return (
            <NavLink
              key={document.id}
              href={documentHref}
              label={document.title}
              active={pathname === documentHref}
            >
              <DocumentResourceIcon resource={document.resource} />
            </NavLink>
          )
        })}
      </SidebarSection>

      <SidebarSection
        label={t("helpAndTools")}
        href="/questions"
        active={pathname === "/questions"}
      >
        <NavLink
          href="/questions"
          label={t("commonQuestions")}
          active={pathname === "/questions"}
        >
          <CircleHelp />
        </NavLink>
        {managerAccess && (
          <NavLink href={managerHref} label={t("managerArea")} active={false}>
            <Settings />
          </NavLink>
        )}
        <Separator className="my-4" />
        <ContactButton
          className="h-10 w-full justify-start px-3"
          onBeforeOpen={onContact}
        />
        <LanguageSelector />
      </SidebarSection>
    </nav>
  )
}

function LanguageSelector() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useAppTranslations()
  const search = searchParams.toString()
  const nextLocale = locale === "et" ? "en" : "et"
  const localizedPathname = getPathname({
    locale: nextLocale,
    href: pathname,
  })
  const href = `${localizedPathname}${search ? `?${search}` : ""}`
  const currentLanguage = locale === "et" ? t("estonian") : t("english")

  // Locale changes replace the root document language and must let next-themes
  // run its bootstrap script during document parsing rather than a client render.
  return (
    <a
      href={href}
      hrefLang={nextLocale}
      aria-label={t(
        nextLocale === "en" ? "switchToEnglish" : "switchToEstonian"
      )}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "h-10 w-full justify-start gap-3 px-3 tracking-normal normal-case"
      )}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {locale === "et" ? "🇪🇪" : "🇬🇧"}
      </span>
      {currentLanguage}
    </a>
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
  const t = useAppTranslations()

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
          aria-label={t(open ? "collapseLabel" : "expandLabel", {
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
