"use client"

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
  const { hub, moveTodaySection, setTodaySectionVisibility, showFeedback } =
    useOperations()
  const sections = hub?.todaySections ?? defaultTodaySections

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Today page"
        description="Choose which sections employees see and arrange them in the order that matters most. Changes save automatically."
      />

      <div className="space-y-4">
        {sections.map((section, index) => {
          const detail = sectionDetails.get(section.key)
          const Icon = sectionIcons[section.key]

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
                    <h2 className="font-semibold">{detail?.title}</h2>
                    <Badge variant={section.visible ? "default" : "secondary"}>
                      {section.visible ? "Visible" : "Hidden"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {detail?.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => {
                      void moveTodaySection(section.key, -1)
                      showFeedback(`${detail?.title} moved up.`)
                    }}
                    aria-label={`Move ${detail?.title} up`}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={index === sections.length - 1}
                    onClick={() => {
                      void moveTodaySection(section.key, 1)
                      showFeedback(`${detail?.title} moved down.`)
                    }}
                    aria-label={`Move ${detail?.title} down`}
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
                        `${detail?.title} ${section.visible ? "hidden" : "shown"}.`
                      )
                    }}
                  >
                    {section.visible ? <EyeOff /> : <Eye />}
                    {section.visible ? "Hide" : "Unhide"}
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
