"use client"

import { T, useI18n } from "@/components/providers/i18n-provider"

import { LocalizedLink as Link } from "@/components/localized-link"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  FilePenLine,
  Files,
  Megaphone,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Card, CardContent } from "@/components/ui/card"
import { getAnnouncementState } from "@/lib/operations"

export function ManagerOverview() {
  const { t } = useI18n()
  const {
    hub,
    categories,
    guides,
    events,
    announcements,
    faqs,
    documents,
    employees,
    managerAccess,
  } = useOperations()
  const sections = [
    {
      title: "Guides",
      cards: [
        {
          href: "/manager/categories",
          title: "Guide categories",
          value: categories.length,
          detail: "Shown in guide navigation",
          icon: Tags,
        },
        {
          href: "/manager/guides",
          title: "Guides",
          value: guides.length,
          detail: t("{count} published", {
            count: guides.filter((item) => item.published).length,
          }),
          icon: BookOpen,
        },
      ],
    },
    {
      title: "Workforce",
      cards: [
        {
          href: "/manager/employees",
          title: "Employees",
          value: employees.length,
          detail: t("{count} active", {
            count: employees.filter((item) => item.status === "active").length,
          }),
          icon: Users,
        },
        {
          href: "/manager/access",
          title: "Employee access",
          value: "Protected",
          detail: "Join code and private link",
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: "Other content",
      cards: [
        {
          href: "/manager/calendar",
          title: "Calendar events",
          value: events.length,
          detail: t("{count} published", {
            count: events.filter((item) => item.published).length,
          }),
          icon: CalendarDays,
        },
        {
          href: "/manager/announcements",
          title: "Announcements",
          value: announcements.length,
          detail: t("{count} active", {
            count: announcements.filter(
              (item) =>
                getAnnouncementState(item, new Date(), hub?.timeZone) ===
                "Active"
            ).length,
          }),
          icon: Megaphone,
        },
        {
          href: "/manager/documents",
          title: "Documents",
          value: documents.length,
          detail: t("{count} published", {
            count: documents.filter((item) => item.published).length,
          }),
          icon: Files,
        },
        {
          href: "/manager/questions",
          title: "Common questions",
          value: faqs.length,
          detail: t("{count} published", {
            count: faqs.filter((item) => item.published).length,
          }),
          icon: CircleHelp,
        },
      ],
    },
  ].filter(
    (section) => managerAccess === "owner" || section.title !== "Workforce"
  )
  const drafts =
    guides.filter((item) => !item.published).length +
    events.filter((item) => !item.published).length +
    announcements.filter((item) => !item.published).length +
    faqs.filter((item) => !item.published).length +
    documents.filter((item) => !item.published).length
  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Overview"
        description="See what is available to employees and choose an area to manage."
      />
      {drafts > 0 && (
        <div
          className="flex items-start gap-3 border bg-background p-4"
          role="status"
        >
          <span className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground">
            <FilePenLine className="size-4" />
          </span>
          <div>
            <p className="font-semibold">
              {t(
                drafts === 1
                  ? "{count} draft needs review"
                  : "{count} drafts need review",
                { count: drafts }
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <T>
                Draft items are not visible to employees until they are
                published.
              </T>
            </p>
          </div>
        </div>
      )}
      {sections.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            <T>{section.title}</T>
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {section.cards.map(({ href, title, value, detail, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <Card
                  size="sm"
                  className="h-full shadow-none transition-colors group-hover:bg-muted/40"
                >
                  <CardContent className="flex h-full items-center gap-4">
                    <span className="flex size-9 shrink-0 items-center justify-center bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">
                        <T>{title}</T>
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <T>{detail}</T>
                      </p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold">
                      {value}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
