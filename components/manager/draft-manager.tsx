"use client"

import { useMemo, useState, type ComponentType } from "react"
import { Link } from "@/i18n/navigation"
import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  FilePenLine,
  FileText,
  Files,
  Megaphone,
  Search,
} from "lucide-react"

import { DocumentResourceIcon } from "@/components/documents/document-card"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"
import {
  formatEventDate,
  formatEventTime,
  type Announcement,
  type CalendarEvent,
  type Faq,
} from "@/lib/operations"
import type { Guide } from "@/lib/knowledge-base"
import type { WorkspaceDocument } from "@/lib/documents"
import { richTextToPlainText } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

type DraftType =
  | "guides"
  | "calendarEvents"
  | "announcements"
  | "documents"
  | "commonQuestions"

type DraftItem = {
  key: string
  title: string
  description: string
  type: DraftType
  icon: ComponentType<{ className?: string }>
  editHref: string
  publish: () => Promise<void>
}

const draftTypeOptions = [
  "guides",
  "calendarEvents",
  "announcements",
  "documents",
  "commonQuestions",
] as const satisfies readonly DraftType[]

export function DraftManager() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const {
    hub,
    guides,
    events,
    announcements,
    documents,
    faqs,
    saveGuide,
    saveEvent,
    saveAnnouncement,
    saveDocument,
    saveFaq,
    showFeedback,
  } = useOperations()
  const [query, setQuery] = useState("")
  const [type, setType] = useState<DraftType | "all">("all")

  const drafts = useMemo<DraftItem[]>(
    () => [
      ...guides
        .filter((guide) => !guide.published)
        .map((guide: Guide) => ({
          key: `guide-${guide.id}`,
          title: guide.title,
          description: guide.description,
          type: "guides" as const,
          icon: BookOpen,
          editHref: `/manager/guides/${guide.id}/edit`,
          publish: async () => {
            await saveGuide({
              ...guide,
              published: true,
              updated: "Updated just now",
            })
            showFeedback("guidePublished")
          },
        })),
      ...events
        .filter((event) => !event.published)
        .map((event: CalendarEvent) => ({
          key: `event-${event.id}`,
          title: event.title,
          description: `${formatEventDate(
            event,
            undefined,
            hub?.timeZone,
            languageTag
          )}, ${formatEventTime(
            event,
            hub?.timeZone,
            languageTag,
            t("allDay")
          )} · ${event.location}`,
          type: "calendarEvents" as const,
          icon: CalendarDays,
          editHref: `/manager/calendar/${event.id}/edit`,
          publish: async () => {
            await saveEvent({ ...event, published: true })
            showFeedback("eventPublished")
          },
        })),
      ...announcements
        .filter((announcement) => !announcement.published)
        .map((announcement: Announcement) => ({
          key: `announcement-${announcement.id}`,
          title: announcement.title,
          description: richTextToPlainText(announcement.content),
          type: "announcements" as const,
          icon: Megaphone,
          editHref: `/manager/announcements/${announcement.id}/edit`,
          publish: async () => {
            await saveAnnouncement({ ...announcement, published: true })
            showFeedback("announcementPublished")
          },
        })),
      ...documents
        .filter((document) => !document.published)
        .map((document: WorkspaceDocument) => ({
          key: `document-${document.id}`,
          title: document.title,
          description: document.description,
          type: "documents" as const,
          icon: () => <DocumentResourceIcon resource={document.resource} />,
          editHref: `/manager/documents/${document.id}/edit`,
          publish: async () => {
            await saveDocument({
              ...document,
              published: true,
              updatedAt: Date.now(),
            })
            showFeedback("documentPublished")
          },
        })),
      ...faqs
        .filter((faq) => !faq.published)
        .map((faq: Faq) => ({
          key: `question-${faq.id}`,
          title: faq.question,
          description: faq.answer,
          type: "commonQuestions" as const,
          icon: CircleHelp,
          editHref: `/manager/questions#question-${encodeURIComponent(faq.id)}`,
          publish: async () => {
            await saveFaq({ ...faq, published: true })
            showFeedback("questionPublished")
          },
        })),
    ],
    [
      announcements,
      documents,
      events,
      faqs,
      guides,
      hub?.timeZone,
      languageTag,
      saveAnnouncement,
      saveDocument,
      saveEvent,
      saveFaq,
      saveGuide,
      showFeedback,
      t,
    ]
  )

  const visible = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase()
    return drafts.filter(
      (draft) =>
        (type === "all" || draft.type === type) &&
        `${draft.title} ${draft.description}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
    )
  }, [drafts, query, type])

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="drafts"
        description="draftItemsNotVisibleEmployeesUntilTheyMessage"
      />
      <div className="grid gap-4 border bg-background p-4 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchDraftsPlaceholder")}
            aria-label={t("searchDrafts")}
            className="border border-input pr-3 pl-10"
          />
        </div>
        <Select
          value={type}
          onValueChange={(value) => setType(value as DraftType | "all")}
        >
          <SelectTrigger
            className="w-full border border-input bg-background px-3"
            aria-label={t("filterDraftsByContentType")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <T>allContentTypes</T>
            </SelectItem>
            {draftTypeOptions.map((option) => (
              <SelectItem key={option} value={option}>
                <T>{option}</T>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((draft) => {
            const Icon = draft.icon
            return (
              <Card key={draft.key} size="sm" className="shadow-none">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{draft.title}</h3>
                      <span aria-hidden="true" className="text-border">
                        |
                      </span>
                      <Badge variant="outline">
                        <T>draft</T>
                      </Badge>
                      <span aria-hidden="true" className="text-border">
                        |
                      </span>
                      <Badge variant="secondary">
                        <T>{draft.type}</T>
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {draft.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void draft.publish().catch(() => {
                          // The shared operation runner already shows the error.
                        })
                      }}
                    >
                      <T>publish</T>
                    </Button>
                    <Link
                      href={draft.editHref}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" })
                      )}
                    >
                      <FilePenLine /> <T>edit</T>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={drafts.length ? FileText : Files}
          title={drafts.length ? "noMatchingContent" : "noDraftsToReview"}
          description={
            drafts.length ? "clearSearchChooseFilter" : "allContentPublished"
          }
        />
      )}
    </div>
  )
}
