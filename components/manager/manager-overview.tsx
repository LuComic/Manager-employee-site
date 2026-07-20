"use client"

import Link from "next/link"
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
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getAnnouncementState } from "@/lib/operations"

export function ManagerOverview() {
  const {
    hub,
    categories,
    guides,
    events,
    announcements,
    faqs,
    documents,
    employees,
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
          detail: `${guides.filter((item) => item.published).length} published`,
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
          detail: `${employees.filter((item) => item.status === "active").length} active`,
          icon: Users,
        },
        {
          href: "/manager/access",
          title: "Employee access",
          value: hub?.accessMode === "public" ? "Public" : "Restricted",
          detail: "Current employee access mode",
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
          detail: `${events.filter((item) => item.published).length} published`,
          icon: CalendarDays,
        },
        {
          href: "/manager/announcements",
          title: "Announcements",
          value: announcements.length,
          detail: `${announcements.filter((item) => getAnnouncementState(item, new Date(), hub?.timeZone) === "Active").length} active`,
          icon: Megaphone,
        },
        {
          href: "/manager/documents",
          title: "Documents",
          value: documents.length,
          detail: `${documents.filter((item) => item.published).length} published`,
          icon: Files,
        },
        {
          href: "/manager/questions",
          title: "Common questions",
          value: faqs.length,
          detail: `${faqs.filter((item) => item.published).length} published`,
          icon: CircleHelp,
        },
      ],
    },
  ]
  const drafts =
    guides.filter((item) => !item.published).length +
    events.filter((item) => !item.published).length +
    announcements.filter((item) => !item.published).length +
    faqs.filter((item) => !item.published).length +
    documents.filter((item) => !item.published).length
  return (
    <div className="space-y-8">
      <ManagerHeading
        title="Content overview"
        description="Live counts from your Convex-backed hub update as content changes."
      />
      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {section.cards.map(({ href, title, value, detail, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <Card className="h-full shadow-none transition-shadow group-hover:shadow-md">
                  <CardHeader>
                    <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <CardTitle className="mt-4 text-base">{title}</CardTitle>
                    <CardDescription>{detail}</CardDescription>
                  </CardHeader>
                  <CardFooter className="mt-auto justify-between">
                    <span className="text-3xl font-semibold">{value}</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <Card className="shadow-none">
        <CardHeader>
          <span className="flex size-10 items-center justify-center bg-muted text-muted-foreground">
            <FilePenLine className="size-5" />
          </span>
          <CardTitle className="mt-4 text-base">Draft content</CardTitle>
          <CardDescription>
            {drafts === 0
              ? "Everything is currently published."
              : `${drafts} ${drafts === 1 ? "item is" : "items are"} still in draft. Open a management view to review or publish it.`}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
