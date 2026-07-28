import type { Id } from "@/convex/_generated/dataModel"

export type WorkerNotesEditorState = {
  mode: "idle" | "creating" | "editing"
  draft: string
  editingNoteId: Id<"workerNotes"> | null
  originalText: string
  saving: boolean
}

export type WorkerNotesEditorAction =
  | { type: "startCreating" }
  | {
      type: "beginEditing"
      noteId: Id<"workerNotes">
      text: string
    }
  | { type: "changeDraft"; draft: string }
  | { type: "setSaving"; saving: boolean }
  | { type: "finish"; mode: "idle" | "creating" }
  | { type: "noteDisappeared" }

export const initialWorkerNotesEditorState: WorkerNotesEditorState = {
  mode: "idle",
  draft: "",
  editingNoteId: null,
  originalText: "",
  saving: false,
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
      }
    case "beginEditing":
      return {
        mode: "editing",
        draft: action.text,
        editingNoteId: action.noteId,
        originalText: action.text,
        saving: false,
      }
    case "changeDraft":
      return { ...state, draft: action.draft }
    case "setSaving":
      return { ...state, saving: action.saving }
    case "finish":
      return {
        mode: action.mode,
        draft: "",
        editingNoteId: null,
        originalText: "",
        saving: false,
      }
    case "noteDisappeared":
      if (state.mode !== "editing") return state
      return {
        mode: "creating",
        draft: "",
        editingNoteId: null,
        originalText: "",
        saving: false,
      }
  }
}
