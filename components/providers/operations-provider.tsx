"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { getCategoryIcon, type CategoryIconKey } from "@/lib/category-icons"
import type { Category, Guide } from "@/lib/knowledge-base"
import {
  toDateKey,
  type Announcement,
  type Attachment,
  type CalendarEvent,
  type OperationsState,
} from "@/lib/operations"

export type HubAccessMode = "public" | "restricted"

export type HubInfo = {
  id: Id<"hubs">
  name: string
  slug: string
  accessMode: HubAccessMode
  credentialVersion: number
}

export type HubCredentials = {
  joinCode: string
  privateToken: string
  credentialVersion: number
}

type OperationsContextValue = OperationsState & {
  hub: HubInfo | null
  hubSlug: string
  credential?: string
  hubState:
    | "loading"
    | "ready"
    | "restricted"
    | "not-found"
    | "needs-setup"
    | "auth-error"
  isManager: boolean
  ownerCredentials: HubCredentials | null
  createHub: (
    name: string,
    slug: string,
    accessMode: HubAccessMode
  ) => Promise<void>
  setAccessMode: (accessMode: HubAccessMode) => Promise<void>
  rotateCredentials: () => Promise<HubCredentials>
  grantAnonymousAccess: (credential: string) => void
  leaveHub: () => void
  saveCategory: (category: Category) => Promise<void>
  moveCategory: (id: string, direction: -1 | 1) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  saveGuide: (guide: Guide) => Promise<void>
  deleteGuide: (id: string) => Promise<void>
  saveEvent: (event: CalendarEvent) => Promise<string>
  deleteEvent: (id: string) => Promise<void>
  uploadAttachment: (eventSlug: string, file: File) => Promise<void>
  deleteAttachment: (attachment: Attachment) => Promise<void>
  saveAnnouncement: (announcement: Announcement) => Promise<void>
  deleteAnnouncement: (id: string) => Promise<void>
  submitHelpRequest: (topic: string, message: string) => Promise<void>
  showFeedback: (message: string) => void
}

const OperationsContext = createContext<OperationsContextValue | null>(null)
const ACCESS_TTL = 30 * 24 * 60 * 60 * 1000
const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function randomString(length: number, alphabet: string) {
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    ""
  )
}

function createCredentials(credentialVersion = 1): HubCredentials {
  const code = randomString(8, JOIN_ALPHABET)
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const privateToken = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
  return {
    joinCode: `${code.slice(0, 4)}-${code.slice(4)}`,
    privateToken,
    credentialVersion,
  }
}

function ownerCredentialKey(hubId: string) {
  return `operations-hub:owner-credentials:${hubId}`
}

function employeeCredentialKey(slug: string) {
  return `operations-hub:employee-access:${slug}`
}

function parseStored<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function OperationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isManager = pathname.startsWith("/manager")
  const isAuthPage =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const requestedHubSlug = searchParams.get("hub")?.trim().toLowerCase()
  const [rememberedHubSlug, setRememberedHubSlug] = useState("north-pine")
  const hubSlug = requestedHubSlug || rememberedHubSlug
  const [credential, setCredential] = useState<string | undefined>()
  const [ownerCredentials, setOwnerCredentials] =
    useState<HubCredentials | null>(null)
  const nowDate = toDateKey(new Date())

  useEffect(() => {
    let timeout: number | undefined
    if (requestedHubSlug) {
      localStorage.setItem("operations-hub:active-slug", requestedHubSlug)
      timeout = window.setTimeout(
        () => setRememberedHubSlug(requestedHubSlug),
        0
      )
    } else {
      timeout = window.setTimeout(
        () =>
          setRememberedHubSlug(
            localStorage.getItem("operations-hub:active-slug") || "north-pine"
          ),
        0
      )
    }
    return () => window.clearTimeout(timeout)
  }, [requestedHubSlug])

  const managerSnapshot = useQuery(
    api.hubs.getOwnedSnapshot,
    isManager && isAuthenticated ? { nowDate } : "skip"
  )
  const publicSnapshot = useQuery(
    api.hubs.getPublicSnapshot,
    !isManager && !isAuthPage ? { slug: hubSlug, credential, nowDate } : "skip"
  )

  const createHubMutation = useMutation(api.hubs.create)
  const setAccessModeMutation = useMutation(api.hubs.setAccessMode)
  const rotateCredentialsMutation = useMutation(api.hubs.rotateCredentials)
  const saveCategoryMutation = useMutation(api.content.saveCategory)
  const moveCategoryMutation = useMutation(api.content.moveCategory)
  const deleteCategoryMutation = useMutation(api.content.deleteCategory)
  const saveGuideMutation = useMutation(api.content.saveGuide)
  const deleteGuideMutation = useMutation(api.content.deleteGuide)
  const saveEventMutation = useMutation(api.content.saveEvent)
  const deleteEventMutation = useMutation(api.content.deleteEvent)
  const saveAnnouncementMutation = useMutation(api.content.saveAnnouncement)
  const deleteAnnouncementMutation = useMutation(api.content.deleteAnnouncement)
  const submitHelpMutation = useMutation(api.content.submitHelpRequest)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const attachToEvent = useMutation(api.files.attachToEvent)
  const removeAttachment = useMutation(api.files.remove)
  const discardUpload = useMutation(api.files.discardUpload)

  const activeSnapshot = isManager
    ? managerSnapshot?.kind === "ready"
      ? managerSnapshot
      : null
    : publicSnapshot?.kind === "ready"
      ? publicSnapshot
      : null
  const hub = (activeSnapshot?.hub ??
    (publicSnapshot?.kind === "restricted"
      ? publicSnapshot.hub
      : null)) as HubInfo | null

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const accessFromFragment = fragment.get("access")?.trim()
    if (accessFromFragment) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      )
      const timeout = window.setTimeout(
        () => setCredential(accessFromFragment),
        0
      )
      return () => window.clearTimeout(timeout)
    }
    if (credential) return
    const stored = parseStored<{ credential: string; expiresAt: number }>(
      localStorage.getItem(employeeCredentialKey(hubSlug))
    )
    if (stored && stored.expiresAt > Date.now()) {
      const timeout = window.setTimeout(
        () => setCredential(stored.credential),
        0
      )
      return () => window.clearTimeout(timeout)
    } else {
      localStorage.removeItem(employeeCredentialKey(hubSlug))
      const timeout = window.setTimeout(() => setCredential(undefined), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [credential, hubSlug])

  useEffect(() => {
    if (
      !credential ||
      publicSnapshot?.kind !== "ready" ||
      publicSnapshot.hub.accessMode !== "restricted"
    )
      return
    localStorage.setItem(
      employeeCredentialKey(publicSnapshot.hub.slug),
      JSON.stringify({ credential, expiresAt: Date.now() + ACCESS_TTL })
    )
  }, [credential, publicSnapshot])

  useEffect(() => {
    if (publicSnapshot?.kind === "restricted" && credential) {
      localStorage.removeItem(employeeCredentialKey(hubSlug))
    }
  }, [credential, hubSlug, publicSnapshot])

  useEffect(() => {
    if (!isManager || !hub) return
    const stored = parseStored<HubCredentials>(
      localStorage.getItem(ownerCredentialKey(hub.id))
    )
    const timeout = window.setTimeout(
      () =>
        setOwnerCredentials(
          stored?.credentialVersion === hub.credentialVersion ? stored : null
        ),
      0
    )
    return () => window.clearTimeout(timeout)
  }, [hub, isManager])

  const state = useMemo<OperationsState>(() => {
    if (!activeSnapshot)
      return { categories: [], guides: [], events: [], announcements: [] }
    const categories = activeSnapshot.categories.map((category) => ({
      id: category.id,
      label: category.label,
      description: category.description,
      iconKey: category.iconKey as CategoryIconKey,
    }))
    const categoryById = new Map(
      categories.map((category) => [category.id, category])
    )
    return {
      categories,
      guides: activeSnapshot.guides.map((guide) => ({
        ...guide,
        icon: getCategoryIcon(
          categoryById.get(guide.category)?.iconKey ?? "general"
        ),
      })) as Guide[],
      events: activeSnapshot.events as CalendarEvent[],
      announcements: activeSnapshot.announcements as Announcement[],
    }
  }, [activeSnapshot])

  function managerHubId() {
    if (!isManager || !hub) throw new Error("Create or open your hub first")
    return hub.id
  }

  async function run<T>(operation: () => Promise<T>) {
    try {
      return await operation()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^.*Uncaught Error: /, "")
          : "Something went wrong"
      toast.error(message)
      throw error
    }
  }

  const hubState: OperationsContextValue["hubState"] = isAuthPage
    ? "loading"
    : isManager
      ? authLoading || (isAuthenticated && managerSnapshot === undefined)
        ? "loading"
        : !isAuthenticated
          ? "auth-error"
          : managerSnapshot?.kind === "none"
            ? "needs-setup"
            : "ready"
      : publicSnapshot === undefined
        ? "loading"
        : publicSnapshot.kind

  const value: OperationsContextValue = {
    ...state,
    hub,
    hubSlug,
    credential,
    hubState,
    isManager,
    ownerCredentials,
    createHub: async (name, slug, accessMode) => {
      const credentials = createCredentials()
      const result = await run(() =>
        createHubMutation({
          name,
          slug,
          accessMode,
          joinCode: credentials.joinCode,
          privateToken: credentials.privateToken,
          seedDemoContent: true,
        })
      )
      localStorage.setItem(
        ownerCredentialKey(result.hubId),
        JSON.stringify(credentials)
      )
      setOwnerCredentials(credentials)
    },
    setAccessMode: async (accessMode) => {
      await run(() =>
        setAccessModeMutation({ hubId: managerHubId(), accessMode })
      )
    },
    rotateCredentials: async () => {
      const hubId = managerHubId()
      const credentials = createCredentials((hub?.credentialVersion ?? 0) + 1)
      const result = await run(() =>
        rotateCredentialsMutation({
          hubId,
          joinCode: credentials.joinCode,
          privateToken: credentials.privateToken,
        })
      )
      const saved = {
        ...credentials,
        credentialVersion: result.credentialVersion,
      }
      localStorage.setItem(ownerCredentialKey(hubId), JSON.stringify(saved))
      setOwnerCredentials(saved)
      return saved
    },
    grantAnonymousAccess: (value) => setCredential(value.trim()),
    leaveHub: () => {
      localStorage.removeItem(employeeCredentialKey(hubSlug))
      setCredential(undefined)
    },
    saveCategory: async (category) => {
      await run(() =>
        saveCategoryMutation({
          hubId: managerHubId(),
          slug: category.id,
          label: category.label,
          iconKey: category.iconKey,
          description: category.description,
        })
      )
    },
    moveCategory: async (slug, direction) => {
      await run(() =>
        moveCategoryMutation({ hubId: managerHubId(), slug, direction })
      )
    },
    deleteCategory: async (slug) => {
      await run(() => deleteCategoryMutation({ hubId: managerHubId(), slug }))
    },
    saveGuide: async (guide) => {
      await run(() =>
        saveGuideMutation({
          hubId: managerHubId(),
          slug: guide.id,
          title: guide.title,
          description: guide.description,
          categorySlug: guide.category,
          duration: guide.duration,
          featured: Boolean(guide.featured),
          published: Boolean(guide.published),
          keywords: guide.keywords ?? [],
          content: guide.content,
        })
      )
    },
    deleteGuide: async (slug) => {
      await run(() => deleteGuideMutation({ hubId: managerHubId(), slug }))
    },
    saveEvent: async (event) => {
      return await run(() =>
        saveEventMutation({
          hubId: managerHubId(),
          slug: event.id,
          title: event.title,
          description: event.description,
          category: event.category,
          start: event.start,
          end: event.end,
          location: event.location,
          owner: event.owner,
          notes: event.notes,
          published: event.published,
          guideSlugs: event.guideIds,
        })
      )
    },
    deleteEvent: async (slug) => {
      await run(() => deleteEventMutation({ hubId: managerHubId(), slug }))
    },
    uploadAttachment: async (eventSlug, file) => {
      const hubId = managerHubId()
      const uploadUrl = await run(() => generateUploadUrl({ hubId }))
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      })
      if (!response.ok) throw new Error("File upload failed")
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">
      }
      try {
        await run(() =>
          attachToEvent({
            hubId,
            eventSlug,
            storageId,
            name: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          })
        )
      } catch (error) {
        await discardUpload({ hubId, storageId })
        throw error
      }
    },
    deleteAttachment: async (attachment) => {
      await run(() =>
        removeAttachment({
          hubId: managerHubId(),
          attachmentId: attachment.id as Id<"attachments">,
        })
      )
    },
    saveAnnouncement: async (announcement) => {
      await run(() =>
        saveAnnouncementMutation({
          hubId: managerHubId(),
          slug: announcement.id,
          title: announcement.title,
          content: announcement.content,
          publishedAt: announcement.publishedAt,
          expiresAt: announcement.expiresAt,
          priority: announcement.priority,
          pinned: announcement.pinned,
          published: announcement.published,
          guideSlug: announcement.guideId,
          eventSlug: announcement.eventId,
        })
      )
    },
    deleteAnnouncement: async (slug) => {
      await run(() =>
        deleteAnnouncementMutation({ hubId: managerHubId(), slug })
      )
    },
    submitHelpRequest: async (topic, message) => {
      await run(() =>
        submitHelpMutation({ hubSlug, credential, topic, message })
      )
    },
    showFeedback: (message) => toast.success(message),
  }

  return (
    <OperationsContext.Provider value={value}>
      {children}
    </OperationsContext.Provider>
  )
}

export function useOperations() {
  const context = useContext(OperationsContext)
  if (!context)
    throw new Error("useOperations must be used within OperationsProvider")
  return context
}
