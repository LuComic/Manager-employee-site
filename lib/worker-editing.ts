export const workerEditableSections = [
  "guides",
  "events",
  "announcements",
  "documents",
  "faqs",
] as const

export type WorkerEditableSection = (typeof workerEditableSections)[number]

export type WorkersCanEdit = Record<WorkerEditableSection, boolean>

export const workerManagerPaths = {
  guides: "/manager/guides",
  events: "/manager/calendar",
  announcements: "/manager/announcements",
  documents: "/manager/documents",
  faqs: "/manager/questions",
} satisfies Record<WorkerEditableSection, string>

export const defaultWorkersCanEdit: WorkersCanEdit = {
  guides: false,
  events: false,
  announcements: false,
  documents: false,
  faqs: false,
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
  }
}

export function firstWorkerManagerPath(value?: Partial<WorkersCanEdit>) {
  const workersCanEdit = normalizeWorkersCanEdit(value)
  const section = workerEditableSections.find(
    (candidate) => workersCanEdit[candidate]
  )
  return section ? workerManagerPaths[section] : null
}
