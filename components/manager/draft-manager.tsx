"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Link } from "@/i18n/navigation"
import {
  BookOpen,
  CalendarDays,
  FilePenLine,
  FileText,
  Files,
  Megaphone,
  Search,
} from "lucide-react"

import { DocumentResourceIcon } from "@/components/documents/document-card"
import { ManagerFilterPanel } from "@/components/manager/manager-filter-panel"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { ManagerListItem } from "@/components/manager/manager-list-item"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { T } from "@/components/translated-text"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
} from "@/lib/operations"
import type { Guide } from "@/lib/knowledge-base"
import type { WorkspaceDocument } from "@/lib/documents"
import { richTextToPlainText } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

type DraftType = "guides" | "calendarEvents" | "announcements" | "documents"

type DraftItem = {
  key: string
  title: string
  description: string
  type: DraftType
  icon: ReactNode
  editHref: string
  publish: () => Promise<void>
}

const draftTypeOptions = [
  "guides",
  "calendarEvents",
  "announcements",
  "documents",
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
    saveGuide,
    saveEvent,
    saveAnnouncement,
    saveDocument,
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
          icon: <BookOpen className="size-5" />,
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
          icon: <CalendarDays className="size-5" />,
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
          icon: <Megaphone className="size-5" />,
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
          icon: <DocumentResourceIcon resource={document.resource} />,
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
    ],
    [
      announcements,
      documents,
      events,
      guides,
      hub?.timeZone,
      languageTag,
      saveAnnouncement,
      saveDocument,
      saveEvent,
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
      <ManagerFilterPanel className="grid sm:grid-cols-2">
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
      </ManagerFilterPanel>
      {visible.length ? (
        <div className="space-y-4">
          {visible.map((draft) => (
            <ManagerListItem
              key={draft.key}
              icon={draft.icon}
              title={draft.title}
              metadata={[
                <Badge key="status" variant="outline">
                  <T>draft</T>
                </Badge>,
                <Badge key="type" variant="secondary">
                  <T>{draft.type}</T>
                </Badge>,
              ]}
              description={draft.description}
              descriptionClassName="line-clamp-2"
              actions={
                <>
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
                    <FilePenLine data-icon="inline-start" /> <T>edit</T>
                  </Link>
                </>
              }
            />
          ))}
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
