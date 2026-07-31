"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
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
  type LucideIcon,
} from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Card, CardContent } from "@/components/ui/card"
import type { AppMessageKey } from "@/i18n/messages"
import { getAnnouncementState } from "@/lib/operations"

type OverviewSection = {
  title: AppMessageKey
  cards: {
    href: string
    title: AppMessageKey
    value: string | number
    detail: string
    icon: LucideIcon
  }[]
}

export function ManagerOverview() {
  const t = useAppTranslations()
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
  const sections = (
    [
      {
        title: "guides",
        cards: [
          {
            href: "/manager/categories",
            title: "categories",
            value: categories.length,
            detail: t("guideCategoriesAndEventTypesCountMessage", {
              guideCount: categories.filter((item) => item.kind === "guide")
                .length,
              eventTypeCount: categories.filter((item) => item.kind === "event")
                .length,
            }),
            icon: Tags,
          },
          {
            href: "/manager/guides",
            title: "guides",
            value: guides.length,
            detail: t("publishedCount", {
              count: guides.filter((item) => item.published).length,
            }),
            icon: BookOpen,
          },
        ],
      },
      {
        title: "workforce",
        cards: [
          {
            href: "/manager/employees",
            title: "employees",
            value: employees.length,
            detail: t("activeCount", {
              count: employees.filter((item) => item.status === "active")
                .length,
            }),
            icon: Users,
          },
          {
            href: "/manager/access",
            title: "employeeAccess",
            value: t("protectedStatus"),
            detail: t("joinCodeAndPrivateLink"),
            icon: ShieldCheck,
          },
        ],
      },
      {
        title: "otherContent",
        cards: [
          {
            href: "/manager/calendar",
            title: "calendarEvents",
            value: events.length,
            detail: t("publishedCount", {
              count: events.filter((item) => item.published).length,
            }),
            icon: CalendarDays,
          },
          {
            href: "/manager/announcements",
            title: "announcements",
            value: announcements.length,
            detail: t("activeCount", {
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
            title: "documents",
            value: documents.length,
            detail: t("publishedCount", {
              count: documents.filter((item) => item.published).length,
            }),
            icon: Files,
          },
          {
            href: "/manager/questions",
            title: "commonQuestions",
            value: faqs.length,
            detail: t("availableToEmployees"),
            icon: CircleHelp,
          },
        ],
      },
    ] satisfies OverviewSection[]
  ).filter(
    (section) => managerAccess === "owner" || section.title !== "workforce"
  )
  const drafts =
    guides.filter((item) => !item.published).length +
    events.filter((item) => !item.published).length +
    announcements.filter((item) => !item.published).length +
    documents.filter((item) => !item.published).length
  return (
    <div className="space-y-6">
      <ManagerHeading
        title="overview"
        description="seeWhatAvailableEmployeesChooseAreaManage"
      />
      {drafts > 0 && (
        <Link
          href="/manager/drafts"
          className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Card
            size="sm"
            className="shadow-none transition-colors group-hover:bg-muted/40"
          >
            <CardContent className="flex items-center gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground">
                <FilePenLine className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">
                  {t(
                    drafts === 1
                      ? "draftReviewCountSingular"
                      : "draftReviewCountPlural",
                    { count: drafts }
                  )}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <T>draftItemsNotVisibleEmployeesUntilTheyMessage</T>
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </CardContent>
          </Card>
        </Link>
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
                        {detail}
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
