"use client"

import { T } from "@/components/translated-text"

import { useState } from "react"
import { ArrowLeft, Eye, Megaphone, Pencil } from "lucide-react"

import { AnnouncementArticle } from "@/components/announcements/announcement-detail"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { Button } from "@/components/ui/button"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  slugify,
  toDateKey,
  type Announcement,
  type AnnouncementPriority,
} from "@/lib/operations"
import {
  emptyRichTextDocument,
  isRichTextEmpty,
  type RichTextDocument,
} from "@/lib/rich-text"

type AnnouncementDraft = Omit<Announcement, "content"> & {
  content: RichTextDocument
}

function cloneContent(content: RichTextDocument) {
  return JSON.parse(JSON.stringify(content)) as RichTextDocument
}

function newAnnouncement(timeZone?: string): AnnouncementDraft {
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  return {
    id: "",
    title: "",
    content: cloneContent(emptyRichTextDocument),
    publishedAt: toDateKey(new Date(), timeZone),
    expiresAt: toDateKey(expires, timeZone),
    priority: "Normal",
    pinned: false,
    published: false,
  }
}

export function AnnouncementEditor({
  announcementId,
}: {
  announcementId?: string
}) {
  const t = useAppTranslations()
  const { hub, announcements, guides, events, saveAnnouncement, showFeedback } =
    useOperations()
  const existing = announcementId
    ? announcements.find((announcement) => announcement.id === announcementId)
    : undefined
  const [draft, setDraft] = useState<AnnouncementDraft | null>(() =>
    announcementId
      ? existing
        ? { ...existing, content: cloneContent(existing.content) }
        : null
      : newAnnouncement(hub?.timeZone)
  )
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const { leaveWithoutPrompt, requestLeave } = useUnsavedChanges({
    dirty,
    itemName: "announcement",
    toastId: "discard-announcement-changes",
    onDiscard: () => setDirty(false),
  })

  function change(patch: Partial<AnnouncementDraft>) {
    if (!draft) return
    setDraft({ ...draft, ...patch })
    setDirty(true)
  }

  function leave() {
    requestLeave("/manager/announcements")
  }

  async function submit() {
    if (!draft) return
    if (!draft.title.trim() || isRichTextEmpty(draft.content))
      return setError("addATitleAndMessage")
    if (!draft.publishedAt || !draft.expiresAt)
      return setError("addPublishAndExpirationDates")
    if (draft.expiresAt < draft.publishedAt)
      return setError("expirationDateCannotBeforePublishDate")

    let id = draft.id
    if (!id) {
      const base = slugify(draft.title) || "announcement"
      id = base
      let suffix = 2
      while (announcements.some((announcement) => announcement.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }
    setSaving(true)
    try {
      await saveAnnouncement({
        ...draft,
        id,
        title: draft.title.trim(),
        guideId: draft.guideId || undefined,
        eventId: draft.eventId || undefined,
      })
      setDirty(false)
      showFeedback(draft.id ? "announcementSaved" : "announcementCreated")
      leaveWithoutPrompt("/manager/announcements")
    } finally {
      setSaving(false)
    }
  }

  if (!draft)
    return (
      <EmptyState
        icon={Megaphone}
        title="announcementNotFound"
        description="announcementRemovedCurrentSession"
        actionLabel="backToAnnouncements"
        actionHref="/manager/announcements"
      />
    )

  const previewAnnouncement: Announcement = {
    ...draft,
    id: draft.id || "preview",
    title: draft.title || t("untitledAnnouncement"),
  }
  const previewGuide = guides.find(
    (guide) => guide.id === draft.guideId && guide.published
  )
  const previewEvent = events.find(
    (event) => event.id === draft.eventId && event.published
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={leave}>
            <ArrowLeft /> <T>backToAnnouncements</T>
          </Button>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            <T>{draft.id ? "editAnnouncement" : "createAnnouncement"}</T>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <T>writeClearUpdateControlEmployeesSee</T>
          </p>
        </div>
        <SegmentedControl aria-label={t("announcementEditorView")}>
          <SegmentedControlItem
            type="button"
            selected={mode === "edit"}
            onClick={() => setMode("edit")}
          >
            <Pencil /> <T>edit</T>
          </SegmentedControlItem>
          <SegmentedControlItem
            type="button"
            selected={mode === "preview"}
            onClick={() => setMode("preview")}
          >
            <Eye /> <T>preview</T>
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      {mode === "preview" ? (
        <div className="border bg-muted/20 p-4 sm:p-6">
          <AnnouncementArticle
            announcement={previewAnnouncement}
            guide={previewGuide}
            event={previewEvent}
            preview
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-6">
            <Card className="shadow-none">
              <CardContent>
                <Field label="title" id="announcement-title">
                  <Input
                    id="announcement-title"
                    value={draft.title}
                    onChange={(event) => change({ title: event.target.value })}
                    className="border border-input px-3 text-base"
                  />
                </Field>
              </CardContent>
            </Card>
            <div>
              <Label className="mb-2 block">
                <T>message</T>
              </Label>
              <RichTextEditor
                value={draft.content}
                onChange={(content) => change({ content })}
                ariaLabel="Announcement message"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                <T>useHeadingsListsAnnouncementNeedsMoreDetail</T>
              </p>
            </div>
          </div>

          <Card className="h-fit shadow-none">
            <CardContent className="space-y-4">
              <Field label="publishDate" id="announcement-start">
                <Input
                  id="announcement-start"
                  type="date"
                  value={draft.publishedAt}
                  onChange={(event) =>
                    change({ publishedAt: event.target.value })
                  }
                  className="border border-input px-3"
                />
              </Field>
              <Field label="expirationDate" id="announcement-end">
                <Input
                  id="announcement-end"
                  type="date"
                  value={draft.expiresAt}
                  onChange={(event) =>
                    change({ expiresAt: event.target.value })
                  }
                  className="border border-input px-3"
                />
              </Field>
              <Field label="priority" id="announcement-priority">
                <Select
                  value={draft.priority}
                  onValueChange={(value) =>
                    change({
                      priority: value as AnnouncementPriority,
                    })
                  }
                >
                  <SelectTrigger
                    id="announcement-priority"
                    className="w-full border border-input bg-background px-3"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">
                      <T>normal</T>
                    </SelectItem>
                    <SelectItem value="Important">
                      <T>important</T>
                    </SelectItem>
                    <SelectItem value="Urgent">
                      <T>urgent</T>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="relatedGuide" id="announcement-guide">
                <Select
                  value={draft.guideId ?? "none"}
                  onValueChange={(value) =>
                    change({
                      guideId: !value || value === "none" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="announcement-guide"
                    className="w-full border border-input bg-background px-3"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <T>noRelatedGuide</T>
                    </SelectItem>
                    {guides.map((guide) => (
                      <SelectItem key={guide.id} value={guide.id}>
                        {guide.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="relatedEvent" id="announcement-event">
                <Select
                  value={draft.eventId ?? "none"}
                  onValueChange={(value) =>
                    change({
                      eventId: !value || value === "none" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger
                    id="announcement-event"
                    className="w-full border border-input bg-background px-3"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <T>noRelatedEvent</T>
                    </SelectItem>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(event) =>
                    change({ published: event.target.checked })
                  }
                />
                <T>publishNow</T>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.pinned}
                  onChange={(event) => change({ pinned: event.target.checked })}
                />
                <T>pinAnnouncement</T>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              <T>{error}</T>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <T>{dirty ? "unsavedChanges" : "noUnsavedChanges"}</T>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={leave}>
            <T>cancel</T>
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            <T>{saving ? "saving" : "saveAnnouncement"}</T>
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  id,
  children,
}: {
  label: AppMessageKey
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        <T>{label}</T>
      </Label>
      {children}
    </div>
  )
}
