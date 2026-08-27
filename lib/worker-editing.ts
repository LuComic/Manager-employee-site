export const workerEditableSections = [
  "guides",
  "events",
  "announcements",
  "documents",
  "faqs",
  "trades",
] as const

export type WorkerEditableSection = (typeof workerEditableSections)[number]

export type ManagerAccess = "viewer" | "editor" | "manager" | "owner" | null

export type WorkersCanEdit = Record<WorkerEditableSection, boolean>

export const workerManagerPaths = {
  guides: "/manager/guides",
  events: "/manager/calendar",
  announcements: "/manager/announcements",
  documents: "/manager/documents",
  faqs: "/manager/questions",
  trades: "/manager/trades",
} satisfies Record<WorkerEditableSection, string>

export const defaultWorkersCanEdit: WorkersCanEdit = {
  guides: false,
  events: false,
  announcements: false,
  documents: false,
  faqs: false,
  trades: false,
}

export function normalizeWorkersCanEdit(
  value?: Partial<WorkersCanEdit>
): WorkersCanEdit {
  return {
    guides: value?.guides ?? false,
    events: value?.events ?? false,
    announcements: value?.announcements ?? false,
    documents: value?.documents ?? false,
    faqs: value?.faqs ?? false,
    trades: value?.trades ?? false,
  }
}

export function firstWorkerManagerPath(value?: Partial<WorkersCanEdit>) {
  const workersCanEdit = normalizeWorkersCanEdit(value)
  const section = workerEditableSections.find(
    (candidate) => workersCanEdit[candidate]
  )
  return section ? workerManagerPaths[section] : null
}

export function canAccessTradeManager(
  access: ManagerAccess,
  tradesEnabled: boolean
) {
  return (
    access === "owner" ||
    access === "manager" ||
    Boolean(access && tradesEnabled)
  )
}

export function workerSectionForManagerPath(
  pathname: string
): WorkerEditableSection | null {
  if (pathname.startsWith("/manager/guides")) return "guides"
  if (pathname.startsWith("/manager/calendar")) return "events"
  if (pathname.startsWith("/manager/announcements")) return "announcements"
  if (pathname.startsWith("/manager/documents")) return "documents"
  if (pathname.startsWith("/manager/questions")) return "faqs"
  if (pathname.startsWith("/manager/trades")) return "trades"
  return null
}

export function canAccessManagerPath(args: {
  access: ManagerAccess
  pathname: string
  workersCanEdit?: Partial<WorkersCanEdit>
}) {
  const { access, pathname } = args
  const workersCanEdit = normalizeWorkersCanEdit(args.workersCanEdit)
  const workerSection = workerSectionForManagerPath(pathname)
  const workerRouteAllowed = Boolean(
    workerSection && workersCanEdit[workerSection]
  )
  const contentRoute =
    pathname === "/manager" ||
    pathname.startsWith("/manager/today") ||
    pathname.startsWith("/manager/guides") ||
    pathname.startsWith("/manager/categories") ||
    pathname.startsWith("/manager/calendar") ||
    pathname.startsWith("/manager/schedules") ||
    pathname.startsWith("/manager/trades") ||
    pathname.startsWith("/manager/announcements") ||
    pathname.startsWith("/manager/documents") ||
    pathname.startsWith("/manager/questions") ||
    pathname.startsWith("/manager/drafts") ||
    pathname.startsWith("/manager/logs") ||
    pathname.startsWith("/manager/notifications")
  const managerOnlyRoute =
    pathname.startsWith("/manager/logs") ||
    pathname.startsWith("/manager/schedules")
  const editorTradeRouteAllowed =
    workerSection !== "trades" ||
    canAccessTradeManager(access, workerRouteAllowed)

  return (
    access === "owner" ||
    (access === "manager" && contentRoute) ||
    (access === "editor" &&
      contentRoute &&
      !managerOnlyRoute &&
      editorTradeRouteAllowed &&
      (!pathname.endsWith("/new") || workerRouteAllowed)) ||
    (access === "viewer" && workerRouteAllowed)
  )
}
