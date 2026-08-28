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
  ArrowLeftRight,
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
import { firstWorkerManagerPath } from "@/lib/worker-editing"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const t = useAppTranslations()
  const { guideCategories, documents, hub, managerAccess } = useOperations()
  const publishedDocuments = documents.filter((document) => document.published)
  const managerHref =
    managerAccess === "viewer"
      ? (firstWorkerManagerPath(hub?.workersCanEdit) ?? "/manager")
      : "/manager"

  return (
    <nav
      className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      aria-label={t("knowledgeBaseNavigation")}
    >
      <SidebarSection
        label={t("workspace")}
        href="/"
        active={pathname === "/"}
        onNavigate={onNavigate}
      >
        <NavLink
          href="/"
          label={t("today")}
          active={pathname === "/"}
          onNavigate={onNavigate}
        >
          <Home />
        </NavLink>
        <NavLink
          href="/notifications"
          label={t("notifications")}
          active={pathname === "/notifications"}
          onNavigate={onNavigate}
        >
          <Bell />
        </NavLink>
        <NavLink
          href="/guides"
          label={t("guides")}
          active={pathname === "/guides" || pathname.startsWith("/guides/")}
          onNavigate={onNavigate}
        >
          <BookOpen />
        </NavLink>
        <NavLink
          href="/announcements"
          label={t("announcements")}
          active={pathname.startsWith("/announcements")}
          onNavigate={onNavigate}
        >
          <Megaphone />
        </NavLink>
      </SidebarSection>

      <SidebarSection
        label={t("workplace")}
        href="/calendar"
        active={
          pathname.startsWith("/calendar") || pathname.startsWith("/trades")
        }
        onNavigate={onNavigate}
      >
        <NavLink
          href="/calendar"
          label={t("calendar")}
          active={pathname.startsWith("/calendar")}
          onNavigate={onNavigate}
        >
          <CalendarDays />
        </NavLink>
        {hub &&
          managerAccess &&
          (managerAccess === "owner" || hub.workersCanEdit.trades) && (
            <NavLink
              href="/trades"
              label={t("trades")}
              active={pathname.startsWith("/trades")}
              onNavigate={onNavigate}
            >
              <ArrowLeftRight />
            </NavLink>
          )}
      </SidebarSection>

      <SidebarSection
        label={t("guideCategories")}
        href="/categories"
        active={pathname.startsWith("/categories")}
        onNavigate={onNavigate}
      >
        {guideCategories.map((category) => {
          const categoryHref = `/categories/${category.id}`

          return (
            <NavLink
              key={category.id}
              href={categoryHref}
              label={category.label}
              active={pathname === categoryHref}
              onNavigate={onNavigate}
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
        onNavigate={onNavigate}
      >
        {publishedDocuments.slice(0, 8).map((document) => {
          const documentHref = `/documents/${document.id}`
          return (
            <NavLink
              key={document.id}
              href={documentHref}
              label={document.title}
              active={pathname === documentHref}
              onNavigate={onNavigate}
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
        onNavigate={onNavigate}
      >
        <NavLink
          href="/questions"
          label={t("commonQuestions")}
          active={pathname === "/questions"}
          onNavigate={onNavigate}
        >
          <CircleHelp />
        </NavLink>
        {managerAccess && (
          <NavLink
            href={managerHref}
            label={t("managerArea")}
            active={false}
            onNavigate={onNavigate}
          >
            <Settings />
          </NavLink>
        )}
        <Separator className="my-4" />
        <ContactButton
          className="h-10 w-full justify-start px-3"
          onBeforeOpen={onNavigate}
        />
        <LanguageSelector onNavigate={onNavigate} />
      </SidebarSection>
    </nav>
  )
}

function LanguageSelector({ onNavigate }: { onNavigate?: () => void }) {
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
      onClick={onNavigate}
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
  onNavigate,
}: {
  label: string
  href: string
  active: boolean
  children: React.ReactNode
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(true)
  const contentId = useId()
  const t = useAppTranslations()

  return (
    <div>
      <div className="flex items-center">
        <Link
          href={href}
          onClick={onNavigate}
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
  onNavigate,
}: {
  href: string
  label: string
  active: boolean
  children: React.ReactNode
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "h-auto min-h-10 w-full justify-start gap-3 px-3 py-2 text-left tracking-normal normal-case sm:h-10 sm:py-0",
        active && "bg-sidebar-accent text-sidebar-accent-foreground"
      )}
    >
      <span
        className={cn(
          "shrink-0 text-muted-foreground",
          active && "text-primary"
        )}
      >
        {children}
      </span>
      <span className="min-w-0 flex-1 text-left sm:min-w-fit sm:flex-none sm:whitespace-nowrap">
        {label}
      </span>
    </Link>
  )
}
