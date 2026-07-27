"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Eye,
  EyeOff,
  LayoutTemplate,
  Link2,
  Megaphone,
} from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  defaultTodaySections,
  todaySectionDefinitions,
  type TodaySectionKey,
} from "@/lib/today-sections"
import { cn } from "@/lib/utils"

const sectionIcons = {
  welcome: LayoutTemplate,
  "quick-links": Link2,
  "happening-today": CalendarDays,
  "current-announcements": Megaphone,
  "coming-next": CalendarClock,
  "useful-guides": BookOpen,
} satisfies Record<TodaySectionKey, typeof BookOpen>

const sectionDetails = new Map(
  todaySectionDefinitions.map((section) => [section.key, section])
)

export function TodayManager() {
  const t = useAppTranslations()
  const { hub, moveTodaySection, setTodaySectionVisibility, showFeedback } =
    useOperations()
  const sections = hub?.todaySections ?? defaultTodaySections

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="todayPage"
        description="chooseWhichSectionsEmployeesSeeArrangeOrderMessage"
      />

      <div className="space-y-4">
        {sections.map((section, index) => {
          const detail = sectionDetails.get(section.key)
          const Icon = sectionIcons[section.key]
          const sectionName = detail ? t(detail.titleKey) : ""

          return (
            <Card
              key={section.key}
              size="sm"
              className={cn("shadow-none", !section.visible && "bg-muted/40")}
            >
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary",
                    !section.visible && "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{sectionName}</h2>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant={section.visible ? "default" : "secondary"}>
                      <T>{section.visible ? "visible" : "hidden"}</T>
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {detail ? t(detail.descriptionKey) : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => {
                      void moveTodaySection(section.key, -1)
                      showFeedback("sectionMovedUp", { name: sectionName })
                    }}
                    aria-label={t("moveNameUp", {
                      name: sectionName,
                    })}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={index === sections.length - 1}
                    onClick={() => {
                      void moveTodaySection(section.key, 1)
                      showFeedback("sectionMovedDown", { name: sectionName })
                    }}
                    aria-label={t("moveNameDown", {
                      name: sectionName,
                    })}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void setTodaySectionVisibility(
                        section.key,
                        !section.visible
                      )
                      showFeedback(
                        section.visible ? "sectionHidden" : "sectionShown",
                        { name: sectionName }
                      )
                    }}
                  >
                    {section.visible ? <EyeOff /> : <Eye />}
                    <T>{section.visible ? "hide" : "unhide"}</T>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
