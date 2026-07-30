export const workerEditableSections = [
  "guides",
  "events",
  "announcements",
  "documents",
] as const

export type WorkerEditableSection = (typeof workerEditableSections)[number]

export type WorkersCanEdit = Record<WorkerEditableSection, boolean>

export const defaultWorkersCanEdit: WorkersCanEdit = {
  guides: false,
  events: false,
  announcements: false,
  documents: false,
}

export function normalizeWorkersCanEdit(
  value?: Partial<WorkersCanEdit>
): WorkersCanEdit {
  return {
    guides: value?.guides ?? false,
    events: value?.events ?? false,
    announcements: value?.announcements ?? false,
    documents: value?.documents ?? false,
  }
}
