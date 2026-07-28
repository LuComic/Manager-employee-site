import { describe, expect, test } from "bun:test"

import type { Id } from "@/convex/_generated/dataModel"

import {
  initialWorkerNotesEditorState,
  workerNotesEditorReducer,
} from "./worker-notes-editor-state"

const noteId = "worker-note-id" as Id<"workerNotes">

describe("worker notes editor state", () => {
  test("recovers to note creation when the edited note disappears", () => {
    const editing = workerNotesEditorReducer(initialWorkerNotesEditorState, {
      type: "beginEditing",
      noteId,
      text: "Shared note",
    })

    expect(
      workerNotesEditorReducer(editing, { type: "noteDisappeared" })
    ).toEqual({
      mode: "creating",
      draft: "",
      editingNoteId: null,
      originalText: "",
      saving: false,
      conflictText: null,
      revision: 2,
    })
  })

  test("keeps the original text while the draft changes", () => {
    const editing = workerNotesEditorReducer(initialWorkerNotesEditorState, {
      type: "beginEditing",
      noteId,
      text: "Original text",
    })

    expect(
      workerNotesEditorReducer(editing, {
        type: "changeDraft",
        draft: "My update",
      })
    ).toMatchObject({
      mode: "editing",
      draft: "My update",
      originalText: "Original text",
    })
  })

  test("ignores a create completion after the user starts editing a note", () => {
    const creating = workerNotesEditorReducer(initialWorkerNotesEditorState, {
      type: "startCreating",
    })
    const editing = workerNotesEditorReducer(creating, {
      type: "beginEditing",
      noteId,
      text: "Existing note",
    })

    expect(
      workerNotesEditorReducer(editing, {
        type: "finishIfCurrent",
        revision: creating.revision,
        mode: "idle",
      })
    ).toEqual(editing)
  })

  test("preserves the draft and exposes the latest text after a conflict", () => {
    const editing = workerNotesEditorReducer(initialWorkerNotesEditorState, {
      type: "beginEditing",
      noteId,
      text: "Original text",
    })
    const changed = workerNotesEditorReducer(editing, {
      type: "changeDraft",
      draft: "My update",
    })

    expect(
      workerNotesEditorReducer(changed, {
        type: "reconcileConflict",
        revision: changed.revision,
        currentText: "Coworker update",
      })
    ).toMatchObject({
      mode: "editing",
      draft: "My update",
      originalText: "Coworker update",
      conflictText: "Coworker update",
      saving: false,
    })
  })
})
