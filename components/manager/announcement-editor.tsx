"use client"

import { useState } from "react"
import { ArrowLeft, Eye, Megaphone, Pencil } from "lucide-react"

import { AnnouncementArticle } from "@/components/announcements/announcement-detail"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { RichTextEditor } from "@/components/rich-text/rich-text-editor"
import { useUnsavedChanges } from "@/components/manager/use-unsaved-changes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
      return setError("Add a title and message.")
    if (!draft.publishedAt || !draft.expiresAt)
      return setError("Add publish and expiration dates.")
    if (draft.expiresAt < draft.publishedAt)
      return setError("The expiration date cannot be before the publish date.")

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
      showFeedback(draft.id ? "Announcement saved." : "Announcement created.")
      leaveWithoutPrompt("/manager/announcements")
    } finally {
      setSaving(false)
    }
  }

  if (!draft)
    return (
      <EmptyState
        icon={Megaphone}
        title="Announcement not found"
        description="This announcement may have been removed from the current session."
        actionLabel="Back to announcements"
        actionHref="/manager/announcements"
      />
    )

  const previewAnnouncement: Announcement = {
    ...draft,
    id: draft.id || "preview",
    title: draft.title || "Untitled announcement",
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
            <ArrowLeft /> Back to announcements
          </Button>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {draft.id ? "Edit announcement" : "Create announcement"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Write a clear update and control when employees can see it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "edit" ? "secondary" : "outline"}
            onClick={() => setMode("edit")}
          >
            <Pencil /> Edit
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "secondary" : "outline"}
            onClick={() => setMode("preview")}
          >
            <Eye /> Preview
          </Button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="border bg-muted/20 p-4 sm:p-8">
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
                <Field label="Title" id="announcement-title">
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
              <Label className="mb-2 block">Message</Label>
              <RichTextEditor
                value={draft.content}
                onChange={(content) => change({ content })}
                ariaLabel="Announcement message"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Use headings and lists when the announcement needs more detail.
              </p>
            </div>
          </div>

          <Card className="h-fit shadow-none">
            <CardContent className="space-y-4">
              <Field label="Publish date" id="announcement-start">
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
              <Field label="Expiration date" id="announcement-end">
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
              <Field label="Priority" id="announcement-priority">
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
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Important">Important</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Related guide" id="announcement-guide">
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
                    <SelectItem value="none">No related guide</SelectItem>
                    {guides.map((guide) => (
                      <SelectItem key={guide.id} value={guide.id}>
                        {guide.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Related event" id="announcement-event">
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
                    <SelectItem value="none">No related event</SelectItem>
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
                Publish now
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.pinned}
                  onChange={(event) => change({ pinned: event.target.checked })}
                />
                Pin announcement
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="sticky bottom-0 z-10 flex flex-col gap-3 border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {dirty ? "Unsaved changes" : "No unsaved changes"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={leave}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Save announcement"}
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
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
