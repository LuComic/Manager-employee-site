import type { Id } from "@/convex/_generated/dataModel"

export type WorkerNotesEditorState = {
  mode: "idle" | "creating" | "editing"
  draft: string
  editingNoteId: Id<"workerNotes"> | null
  originalText: string
  saving: boolean
  conflictText: string | null
  revision: number
}

export type WorkerNotesEditorAction =
  | { type: "startCreating" }
  | {
      type: "beginEditing"
      noteId: Id<"workerNotes">
      text: string
    }
  | { type: "changeDraft"; draft: string }
  | { type: "setSaving"; revision: number; saving: boolean }
  | { type: "finish"; mode: "idle" | "creating" }
  | {
      type: "finishIfCurrent"
      revision: number
      mode: "idle" | "creating"
    }
  | {
      type: "reconcileConflict"
      revision: number
      currentText: string
    }
  | { type: "noteDisappeared" }

export const initialWorkerNotesEditorState: WorkerNotesEditorState = {
  mode: "idle",
  draft: "",
  editingNoteId: null,
  originalText: "",
  saving: false,
  conflictText: null,
  revision: 0,
}

function finish(
  state: WorkerNotesEditorState,
  mode: "idle" | "creating"
): WorkerNotesEditorState {
  return {
    mode,
    draft: "",
    editingNoteId: null,
    originalText: "",
    saving: false,
    conflictText: null,
    revision: state.revision + 1,
  }
}

export function workerNotesEditorReducer(
  state: WorkerNotesEditorState,
  action: WorkerNotesEditorAction
): WorkerNotesEditorState {
  switch (action.type) {
    case "startCreating":
      return {
        mode: "creating",
        draft: "",
        editingNoteId: null,
        originalText: "",
        saving: false,
        conflictText: null,
        revision: state.revision + 1,
      }
    case "beginEditing":
      return {
        mode: "editing",
        draft: action.text,
        editingNoteId: action.noteId,
        originalText: action.text,
        saving: false,
        conflictText: null,
        revision: state.revision + 1,
      }
    case "changeDraft":
      return { ...state, draft: action.draft }
    case "setSaving":
      if (state.revision !== action.revision) return state
      return { ...state, saving: action.saving }
    case "finish":
      return finish(state, action.mode)
    case "finishIfCurrent":
      if (state.revision !== action.revision) return state
      return finish(state, action.mode)
    case "reconcileConflict":
      if (state.mode !== "editing" || state.revision !== action.revision) {
        return state
      }
      return {
        ...state,
        originalText: action.currentText,
        saving: false,
        conflictText: action.currentText,
        revision: state.revision + 1,
      }
    case "noteDisappeared":
      if (state.mode !== "editing") return state
      return finish(state, "creating")
  }
}
