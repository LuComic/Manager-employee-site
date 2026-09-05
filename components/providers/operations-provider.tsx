"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useSearchParams } from "next/navigation"
import { useAuth, useSession } from "@clerk/nextjs"
import { ConvexHttpClient } from "convex/browser"
import { useConvexAuth, useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import { useLocale, type TranslationValues } from "next-intl"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { usePathname } from "@/i18n/navigation"
import {
  useAppErrorTranslation,
  useAppTranslations,
} from "@/i18n/use-app-translations"
import type { AppMessageKey } from "@/i18n/messages"
import type { Locale } from "@/i18n/routing"
import { workspaceDocumentTitle } from "@/lib/branding"
import {
  isBannerImageContentType,
  MAX_BANNER_IMAGE_SIZE_BYTES,
} from "@/lib/banner-image"
import { getCategoryIcon, type CategoryIconKey } from "@/lib/category-icons"
import { DEPUTY_SCHEDULES_EVENT_TYPE_ID } from "@/lib/categories"
import type { Category, Guide } from "@/lib/knowledge-base"
import type {
  DocumentUploadChanges,
  EditableDocument,
  WorkspaceDocument,
} from "@/lib/documents"
import type { TodaySectionKey, TodaySectionSetting } from "@/lib/today-sections"
import type {
  WorkerEditableSection,
  WorkersCanEdit,
} from "@/lib/worker-editing"
import {
  toDateKey,
  type Announcement,
  type Attachment,
  type CalendarEvent,
  type ContentReference,
  type EmployeeProfile,
  type Faq,
  type OperationsState,
} from "@/lib/operations"

export type HubAccessMode = "public" | "restricted"
export type ManagerAccess = "viewer" | "editor" | "manager" | "owner"

export type HubInfo = {
  id: Id<"hubs">
  name: string
  slug: string
  accessMode: HubAccessMode
  credentialVersion: number
  description: string
  address: string
  timeZone: string
  contactName: string
  contactEmail: string
  contactPhone: string
  bannerImageUrl?: string
  clerkOrganizationId?: string
  todaySections: TodaySectionSetting[]
  workersCanEdit: WorkersCanEdit
}

export type HubSettings = Pick<
  HubInfo,
  | "name"
  | "description"
  | "address"
  | "timeZone"
  | "contactName"
  | "contactEmail"
  | "contactPhone"
>

type OperationsContextValue = OperationsState & {
  guideCategories: Category[]
  eventTypes: Category[]
  hub: HubInfo | null
  hubSlug: string
  credential?: string
  hubState:
    | "loading"
    | "ready"
    | "restricted"
    | "not-found"
    | "deactivated"
    | "needs-setup"
    | "forbidden"
    | "auth-error"
  isManagerRoute: boolean
  managerAccess: ManagerAccess | null
  canCreateContent: boolean
  canCreateInSection: (section: WorkerEditableSection) => boolean
  guideReferences: ContentReference[]
  eventReferences: ContentReference[]
  employees: EmployeeProfile[]
  createHub: (name: string, slug: string) => Promise<void>
  createEmployee: (profile: {
    displayName: string
    email?: string
    department?: string
    jobTitle?: string
    accessLevel: EmployeeProfile["accessLevel"]
  }) => Promise<Id<"employeeProfiles">>
  updateEmployee: (
    profileId: Id<"employeeProfiles">,
    profile: {
      displayName: string
      email?: string
      department?: string
      jobTitle?: string
      accessLevel: EmployeeProfile["accessLevel"]
    }
  ) => Promise<void>
  rotateCredentials: () => Promise<void>
  setAccessMode: (accessMode: HubAccessMode) => Promise<void>
  saveHubSettings: (settings: HubSettings) => Promise<void>
  uploadHubBanner: (file: File) => Promise<void>
  removeHubBanner: () => Promise<void>
  moveTodaySection: (key: TodaySectionKey, direction: -1 | 1) => Promise<void>
  setTodaySectionVisibility: (
    key: TodaySectionKey,
    visible: boolean
  ) => Promise<void>
  setWorkersCanEdit: (
    section: WorkerEditableSection,
    enabled: boolean
  ) => Promise<void>
  grantAnonymousAccess: (credential: string) => void
  leaveHub: () => void
  saveCategory: (category: Category) => Promise<void>
  moveCategory: (category: Category, direction: -1 | 1) => Promise<void>
  deleteCategory: (category: Category) => Promise<void>
  saveGuide: (guide: Guide) => Promise<void>
  deleteGuide: (id: string) => Promise<void>
  saveEvent: (event: CalendarEvent) => Promise<string>
  deleteEvent: (id: string) => Promise<void>
  uploadAttachment: (eventSlug: string, file: File) => Promise<void>
  deleteAttachment: (attachment: Attachment) => Promise<void>
  saveAnnouncement: (announcement: Announcement) => Promise<void>
  acknowledgeAnnouncement: (id: string) => Promise<void>
  deleteAnnouncement: (id: string) => Promise<void>
  saveFaq: (faq: Faq) => Promise<void>
  moveFaq: (id: string, direction: -1 | 1) => Promise<void>
  deleteFaq: (id: string) => Promise<void>
  saveDocument: (
    document: EditableDocument,
    uploads?: DocumentUploadChanges
  ) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  submitHelpRequest: (topic: string, message: string) => Promise<void>
  showFeedback: (
    key: AppMessageKey,
    values?: TranslationValues,
    tone?: "success" | "neutral"
  ) => void
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

function createCredentials() {
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
  }
}

function employeeCredentialKey(slug: string) {
  return `workhal:employee-access:${slug}`
}

function parseStored<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function WorkspaceDocumentTitle({ workspaceName }: { workspaceName?: string }) {
  const previousWorkspaceName = useRef<string | null>(null)

  useEffect(() => {
    const activeWorkspaceName = workspaceName?.trim() || null
    const previousName = previousWorkspaceName.current
    const syncTitle = () => {
      const nextTitle = workspaceDocumentTitle(
        document.title,
        activeWorkspaceName,
        previousName
      )
      if (nextTitle !== document.title) document.title = nextTitle
    }

    syncTitle()
    const observer = new MutationObserver(syncTitle)
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    previousWorkspaceName.current = activeWorkspaceName

    return () => observer.disconnect()
  }, [workspaceName])

  return null
}

export function OperationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const locale = useLocale() as Locale
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
  const searchParams = useSearchParams()
  const isManagerRoute = pathname.startsWith("/manager")
  const isAuthPage =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const { orgId: clerkOrganizationId } = useAuth()
  const { session } = useSession()
  const requestedHubSlug = searchParams.get("hub")?.trim().toLowerCase()
  const [rememberedHubSlug, setRememberedHubSlug] = useState("")
  const hubSlug = requestedHubSlug || rememberedHubSlug
  const [credential, setCredential] = useState<string | undefined>()
  const [hubTimeZone, setHubTimeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  )
  const nowDate = toDateKey(new Date(), hubTimeZone)

  useEffect(() => {
    let timeout: number | undefined
    if (requestedHubSlug) {
      localStorage.setItem("workhal:active-slug", requestedHubSlug)
      timeout = window.setTimeout(
        () => setRememberedHubSlug(requestedHubSlug),
        0
      )
    } else {
      timeout = window.setTimeout(
        () =>
          setRememberedHubSlug(
            localStorage.getItem("workhal:active-slug") || ""
          ),
        0
      )
    }
    return () => window.clearTimeout(timeout)
  }, [requestedHubSlug])

  const managerSnapshot = useQuery(
    api.hubs.getManagerSnapshot,
    isManagerRoute && isAuthenticated
      ? { nowDate, organizationHint: clerkOrganizationId ?? undefined }
      : "skip"
  )
  const navigationManagerAccess = useQuery(
    api.hubs.getManagerAccess,
    !isManagerRoute && !isAuthPage && isAuthenticated
      ? { organizationHint: clerkOrganizationId ?? undefined }
      : "skip"
  )
  const publicSnapshot = useQuery(
    api.hubs.getPublicSnapshot,
    !isManagerRoute &&
      !isAuthPage &&
      !authLoading &&
      (requestedHubSlug || !isAuthenticated)
      ? { slug: hubSlug, credential, nowDate }
      : "skip"
  )
  const memberSnapshot = useQuery(
    api.hubs.getActiveMemberSnapshot,
    !isManagerRoute && !isAuthPage && isAuthenticated && !requestedHubSlug
      ? { nowDate, organizationHint: clerkOrganizationId ?? undefined }
      : "skip"
  )

  const rotateCredentialsMutation = useMutation(api.hubs.rotateCredentials)
  const setAccessModeMutation = useMutation(api.hubs.setAccessMode)
  const updateSettingsMutation = useMutation(api.hubs.updateSettings)
  const moveTodaySectionMutation = useMutation(api.hubs.moveTodaySection)
  const setTodaySectionVisibilityMutation = useMutation(
    api.hubs.setTodaySectionVisibility
  )
  const setWorkersCanEditMutation = useMutation(api.hubs.setWorkersCanEdit)
  const saveCategoryMutation = useMutation(api.content.saveCategory)
  const moveCategoryMutation = useMutation(api.content.moveCategory)
  const deleteCategoryMutation = useMutation(api.content.deleteCategory)
  const saveGuideMutation = useMutation(api.content.saveGuide)
  const deleteGuideMutation = useMutation(api.content.deleteGuide)
  const saveEventMutation = useMutation(api.content.saveEvent)
  const deleteEventMutation = useMutation(api.content.deleteEvent)
  const saveAnnouncementMutation = useMutation(api.content.saveAnnouncement)
  const acknowledgeAnnouncementMutation = useMutation(
    api.content.acknowledgeAnnouncement
  )
  const deleteAnnouncementMutation = useMutation(api.content.deleteAnnouncement)
  const saveFaqMutation = useMutation(api.content.saveFaq)
  const moveFaqMutation = useMutation(api.content.moveFaq)
  const deleteFaqMutation = useMutation(api.content.deleteFaq)
  const submitHelpMutation = useMutation(api.content.submitHelpRequest)
  const saveDocumentMutation = useMutation(api.documents.save)
  const deleteDocumentMutation = useMutation(api.documents.remove)
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const registerUpload = useMutation(api.files.registerUpload)
  const cancelUploadIntent = useMutation(api.files.cancelUploadIntent)
  const attachToEvent = useMutation(api.files.attachToEvent)
  const removeAttachment = useMutation(api.files.remove)
  const discardUpload = useMutation(api.files.discardUpload)
  const attachToHubBanner = useMutation(api.files.attachToHubBanner)
  const removeHubBannerMutation = useMutation(api.files.removeHubBanner)
  const managedEmployeeProfiles = useQuery(
    api.employees.list,
    isManagerRoute &&
      isAuthenticated &&
      managerSnapshot?.kind === "ready" &&
      managerSnapshot.managerAccess === "owner"
      ? { hubId: managerSnapshot.hub.id }
      : "skip"
  )
  const workerAssignmentSection: "events" | "documents" | null =
    managerSnapshot?.kind === "ready" &&
    managerSnapshot.managerAccess === "viewer"
      ? managerSnapshot.hub.workersCanEdit.events
        ? "events"
        : managerSnapshot.hub.workersCanEdit.documents
          ? "documents"
          : null
      : null
  const assignableEmployeeProfiles = useQuery(
    api.employees.listAssignable,
    isManagerRoute &&
      isAuthenticated &&
      managerSnapshot?.kind === "ready" &&
      (managerSnapshot.managerAccess === "editor" ||
        managerSnapshot.managerAccess === "manager" ||
        workerAssignmentSection)
      ? {
          hubId: managerSnapshot.hub.id,
          ...(workerAssignmentSection
            ? { workerSection: workerAssignmentSection }
            : {}),
        }
      : "skip"
  )
  const createEmployeeMutation = useMutation(api.employees.create)
  const updateEmployeeMutation = useMutation(api.employees.update)

  const activeSnapshot = isManagerRoute
    ? managerSnapshot?.kind === "ready"
      ? managerSnapshot
      : null
    : requestedHubSlug || !isAuthenticated
      ? publicSnapshot?.kind === "ready"
        ? publicSnapshot
        : null
      : memberSnapshot?.kind === "ready"
        ? memberSnapshot
        : null
  const hub = (activeSnapshot?.hub ??
    (publicSnapshot?.kind === "restricted"
      ? publicSnapshot.hub
      : null)) as HubInfo | null
  const managerAccess =
    isManagerRoute && managerSnapshot?.kind === "ready"
      ? (managerSnapshot.managerAccess as ManagerAccess)
      : ((navigationManagerAccess ?? null) as ManagerAccess | null)
  useEffect(() => {
    if (!activeSnapshot?.hub.timeZone) return
    const timeout = window.setTimeout(
      () => setHubTimeZone(activeSnapshot.hub.timeZone),
      0
    )
    return () => window.clearTimeout(timeout)
  }, [activeSnapshot?.hub.timeZone])

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
    if (!credential || publicSnapshot?.kind !== "ready") return
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

  const state = useMemo<OperationsState>(() => {
    if (!activeSnapshot)
      return {
        categories: [],
        guides: [],
        events: [],
        announcements: [],
        faqs: [],
        documents: [],
      }
    const storedCategories = activeSnapshot.categories.map((category) => ({
      id: category.id,
      label:
        category.id === DEPUTY_SCHEDULES_EVENT_TYPE_ID
          ? t("schedules")
          : category.label,
      description: category.description,
      iconKey: category.iconKey as CategoryIconKey,
      kind: category.kind,
      color: category.color,
    })) as Category[]
    const categoryById = new Map(
      storedCategories
        .filter((category) => category.kind === "guide")
        .map((category) => [category.id, category])
    )
    return {
      categories: storedCategories,
      guides: activeSnapshot.guides.map((guide) => ({
        ...guide,
        icon: getCategoryIcon(
          categoryById.get(guide.category)?.iconKey ?? "general"
        ),
      })) as Guide[],
      events: activeSnapshot.events as CalendarEvent[],
      announcements: activeSnapshot.announcements as Announcement[],
      faqs: activeSnapshot.faqs as Faq[],
      documents: activeSnapshot.documents as WorkspaceDocument[],
    }
  }, [activeSnapshot, t])
  const guideCategories = state.categories.filter(
    (category) => category.kind === "guide"
  )
  const eventTypes = state.categories.filter(
    (category) => category.kind === "event"
  )
  const guideReferences =
    activeSnapshot && "guideReferences" in activeSnapshot
      ? (activeSnapshot.guideReferences as ContentReference[])
      : state.guides.map(({ id, title, published }) => ({
          id,
          title,
          published: Boolean(published),
        }))
  const eventReferences =
    activeSnapshot && "eventReferences" in activeSnapshot
      ? (activeSnapshot.eventReferences as ContentReference[])
      : state.events.map(({ id, title, published }) => ({
          id,
          title,
          published,
        }))

  function managerHubId() {
    if (!isManagerRoute || !hub) {
      throw new Error("createOrOpenYourHubFirst")
    }
    return hub.id
  }

  function editableHubId(section: WorkerEditableSection) {
    if (
      !hub ||
      !managerAccess ||
      (managerAccess !== "manager" &&
        managerAccess !== "owner" &&
        !hub.workersCanEdit[section])
    ) {
      throw new Error("createOrOpenYourHubFirst")
    }
    return hub.id
  }

  async function run<T>(operation: () => Promise<T>) {
    try {
      return await operation()
    } catch (error) {
      toast.error(translateError(error))
      throw error
    }
  }

  async function uploadAndAttach(
    hubId: Id<"hubs">,
    file: File,
    failureMessage: AppMessageKey,
    attach: (storageId: Id<"_storage">) => Promise<unknown>,
    section?: "events" | "documents"
  ) {
    const storageId = await uploadStoredFile(
      hubId,
      file,
      failureMessage,
      section
    )
    try {
      await attach(storageId)
    } catch (error) {
      await discardUpload({
        hubId,
        storageId,
        ...(section ? { section } : {}),
      }).catch(() => undefined)
      throw error
    }
  }

  async function uploadStoredFile(
    hubId: Id<"hubs">,
    file: File,
    failureMessage: AppMessageKey,
    section?: "events" | "documents"
  ) {
    const contentType = file.type || "application/octet-stream"
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer()
    )
    const sha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
    const { uploadUrl, uploadIntentId } = await generateUploadUrl({
      hubId,
      sha256,
      size: file.size,
      ...(section ? { section } : {}),
    })
    let storageId: Id<"_storage"> | undefined
    try {
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
        },
        body: file,
      })
      if (!response.ok) throw new Error(failureMessage)
      const result = (await response.json()) as { storageId?: unknown }
      if (typeof result.storageId !== "string") throw new Error(failureMessage)
      storageId = result.storageId as Id<"_storage">
      await registerUpload({
        hubId,
        uploadIntentId,
        storageId,
        ...(section ? { section } : {}),
      })
      return storageId
    } catch (error) {
      if (storageId) {
        await discardUpload({
          hubId,
          storageId,
          ...(section ? { section } : {}),
        }).catch(() => undefined)
      }
      await cancelUploadIntent({
        hubId,
        uploadIntentId,
        ...(section ? { section } : {}),
      }).catch(() => undefined)
      throw error
    }
  }

  const hubState: OperationsContextValue["hubState"] =
    isAuthPage || authLoading
      ? "loading"
      : isManagerRoute
        ? isAuthenticated && managerSnapshot === undefined
          ? "loading"
          : !isAuthenticated
            ? "auth-error"
            : managerSnapshot?.kind === "none"
              ? "needs-setup"
              : managerSnapshot?.kind === "forbidden"
                ? "forbidden"
                : "ready"
        : isAuthenticated && !requestedHubSlug
          ? memberSnapshot === undefined
            ? "loading"
            : memberSnapshot.kind === "none"
              ? "not-found"
              : memberSnapshot.kind
          : publicSnapshot === undefined
            ? "loading"
            : publicSnapshot.kind

  const value: OperationsContextValue = {
    ...state,
    guideCategories,
    eventTypes,
    hub,
    hubSlug,
    credential,
    hubState,
    isManagerRoute,
    managerAccess,
    canCreateContent: managerAccess === "manager" || managerAccess === "owner",
    canCreateInSection: (section) =>
      managerAccess === "manager" ||
      managerAccess === "owner" ||
      Boolean(managerAccess && hub?.workersCanEdit[section]),
    guideReferences,
    eventReferences,
    employees: managedEmployeeProfiles
      ? (managedEmployeeProfiles as EmployeeProfile[])
      : ((assignableEmployeeProfiles ?? []).map((profile) => ({
          ...profile,
          accessLevel: "viewer",
          invitationStatus: "not-sent",
        })) as EmployeeProfile[]),
    createHub: async (name, slug) => {
      await run(async () => {
        if (!clerkOrganizationId) {
          throw new Error("createOrSelectAWorkplaceFirst")
        }
        const credentials = createCredentials()
        const response = await fetch("/api/workplaces", {
          method: "POST",
        })
        const result = (await response.json()) as {
          error?: string
          organizationId: string
        }
        if (!response.ok)
          throw new Error(result.error ?? "couldNotConfigureWorkplace")
        const token = await session?.getToken({
          organizationId: result.organizationId,
          skipCache: true,
        })
        if (!token) throw new Error("couldNotCreateAWorkplaceSession")
        const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
        convex.setAuth(token)
        await convex.mutation(api.hubs.create, {
          name,
          slug,
          accessMode: "restricted",
          joinCode: credentials.joinCode,
          privateToken: credentials.privateToken,
          timeZone:
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "Europe/Tallinn",
          locale,
        })
      })
    },
    createEmployee: async (profile) =>
      await run(() =>
        createEmployeeMutation({ hubId: managerHubId(), ...profile })
      ),
    updateEmployee: async (profileId, profile) => {
      await run(() => updateEmployeeMutation({ profileId, ...profile }))
    },
    rotateCredentials: async () => {
      const hubId = managerHubId()
      const credentials = createCredentials()
      await run(() =>
        rotateCredentialsMutation({
          hubId,
          joinCode: credentials.joinCode,
          privateToken: credentials.privateToken,
        })
      )
    },
    setAccessMode: async (accessMode) => {
      await run(() =>
        setAccessModeMutation({ hubId: managerHubId(), accessMode })
      )
    },
    saveHubSettings: async (settings) => {
      await run(() =>
        updateSettingsMutation({ hubId: managerHubId(), ...settings })
      )
    },
    uploadHubBanner: async (file) => {
      const hubId = managerHubId()
      await run(async () => {
        if (!isBannerImageContentType(file.type)) {
          throw new Error("usejpgpngWebpavifImage")
        }
        if (file.size > MAX_BANNER_IMAGE_SIZE_BYTES) {
          throw new Error("bannerImageSizeLimit")
        }
        await uploadAndAttach(hubId, file, "imageUploadFailed", (storageId) =>
          attachToHubBanner({ hubId, storageId })
        )
      })
    },
    removeHubBanner: async () => {
      await run(() => removeHubBannerMutation({ hubId: managerHubId() }))
    },
    moveTodaySection: async (key, direction) => {
      await run(() =>
        moveTodaySectionMutation({ hubId: managerHubId(), key, direction })
      )
    },
    setTodaySectionVisibility: async (key, visible) => {
      await run(() =>
        setTodaySectionVisibilityMutation({
          hubId: managerHubId(),
          key,
          visible,
        })
      )
    },
    setWorkersCanEdit: async (section, enabled) => {
      await run(() =>
        setWorkersCanEditMutation({
          hubId: managerHubId(),
          section,
          enabled,
        })
      )
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
          kind: category.kind,
          color: category.color,
        })
      )
    },
    moveCategory: async (category, direction) => {
      await run(() =>
        moveCategoryMutation({
          hubId: managerHubId(),
          slug: category.id,
          kind: category.kind,
          direction,
        })
      )
    },
    deleteCategory: async (category) => {
      await run(() =>
        deleteCategoryMutation({
          hubId: managerHubId(),
          slug: category.id,
          kind: category.kind,
        })
      )
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
          relatedGuideSlugs: guide.relatedGuideIds ?? [],
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
          hubId: editableHubId("events"),
          slug: event.id,
          title: event.title,
          description: event.description,
          category: event.category,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          startUtc: event.startUtc ?? null,
          endUtc: event.endUtc ?? null,
          icalUid: event.icalUid ?? null,
          location: event.location,
          employeeProfileIds: event.employees.flatMap((employee) =>
            employee.id ? [employee.id as Id<"employeeProfiles">] : []
          ),
          notes: event.notes,
          published: event.published,
          isPrivate: Boolean(event.isPrivate),
          guideSlugs: event.guideIds,
        })
      )
    },
    deleteEvent: async (slug) => {
      await run(() => deleteEventMutation({ hubId: managerHubId(), slug }))
    },
    uploadAttachment: async (eventSlug, file) => {
      const hubId = managerHubId()
      await run(() =>
        uploadAndAttach(
          hubId,
          file,
          "fileUploadFailed",
          (storageId) =>
            attachToEvent({
              hubId,
              eventSlug,
              storageId,
              name: file.name,
              contentType: file.type || "application/octet-stream",
              notifyEmployees: false,
            }),
          "events"
        )
      )
    },
    deleteAttachment: async (attachment) => {
      await run(() =>
        removeAttachment({
          hubId: managerHubId(),
          attachmentId: attachment.id as Id<"attachments">,
          notifyEmployees: false,
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
    acknowledgeAnnouncement: async (slug) => {
      if (!hub) throw new Error("announcementNotAvailable")
      await run(() => acknowledgeAnnouncementMutation({ hubId: hub.id, slug }))
    },
    deleteAnnouncement: async (slug) => {
      await run(() =>
        deleteAnnouncementMutation({ hubId: managerHubId(), slug })
      )
    },
    saveFaq: async (faq) => {
      await run(() =>
        saveFaqMutation({
          hubId: managerHubId(),
          slug: faq.id,
          question: faq.question,
          answer: faq.answer,
        })
      )
    },
    moveFaq: async (slug, direction) => {
      await run(() =>
        moveFaqMutation({ hubId: managerHubId(), slug, direction })
      )
    },
    deleteFaq: async (slug) => {
      await run(() => deleteFaqMutation({ hubId: managerHubId(), slug }))
    },
    saveDocument: async (document, uploads = {}) => {
      const hubId = managerHubId()
      await run(async () => {
        const uploadedStorageIds: Id<"_storage">[] = []
        try {
          const resourceStorageId = uploads.resourceFile
            ? await uploadStoredFile(
                hubId,
                uploads.resourceFile,
                "fileUploadFailed",
                "documents"
              )
            : undefined
          if (resourceStorageId) uploadedStorageIds.push(resourceStorageId)

          if (
            uploads.bannerFile &&
            !isBannerImageContentType(uploads.bannerFile.type)
          ) {
            throw new Error("usejpgpngWebpavifBannerMessage")
          }
          if (
            uploads.bannerFile &&
            uploads.bannerFile.size > MAX_BANNER_IMAGE_SIZE_BYTES
          ) {
            throw new Error("bannerImageSizeLimit")
          }
          const bannerStorageId = uploads.bannerFile
            ? await uploadStoredFile(
                hubId,
                uploads.bannerFile,
                "bannerUploadFailed",
                "documents"
              )
            : undefined
          if (bannerStorageId) uploadedStorageIds.push(bannerStorageId)

          const resource = uploads.resourceFile
            ? {
                kind: "file" as const,
                storageId: resourceStorageId!,
                name: uploads.resourceFile.name,
                contentType:
                  uploads.resourceFile.type || "application/octet-stream",
              }
            : document.resource?.kind === "link"
              ? document.resource
              : undefined
          await saveDocumentMutation({
            hubId,
            slug: document.id,
            title: document.title,
            description: document.description,
            ...(resource ? { resource } : {}),
            ...(bannerStorageId
              ? { bannerStorageId }
              : uploads.removeBanner
                ? { bannerStorageId: null }
                : {}),
            employeeProfileIds: document.employees.flatMap((employee) =>
              employee.id ? [employee.id as Id<"employeeProfiles">] : []
            ),
            relatedGuideSlugs: document.relatedGuideIds ?? [],
            published: document.published,
          })
        } catch (error) {
          await Promise.all(
            uploadedStorageIds.map((storageId) =>
              discardUpload({
                hubId,
                storageId,
                section: "documents",
              }).catch(() => undefined)
            )
          )
          throw error
        }
      })
    },
    deleteDocument: async (slug) => {
      await run(() => deleteDocumentMutation({ hubId: managerHubId(), slug }))
    },
    submitHelpRequest: async (topic, message) => {
      await run(() =>
        submitHelpMutation({ hubSlug, credential, topic, message })
      )
    },
    showFeedback: (key, values, tone = "success") =>
      tone === "neutral"
        ? toast(t(key, values))
        : toast.success(t(key, values)),
  }

  return (
    <OperationsContext.Provider value={value}>
      <WorkspaceDocumentTitle workspaceName={hub?.name} />
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
