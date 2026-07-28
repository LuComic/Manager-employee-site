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

  test("clears edit identity when finishing", () => {
    const editing = workerNotesEditorReducer(initialWorkerNotesEditorState, {
      type: "beginEditing",
      noteId,
      text: "Shared note",
    })

    expect(
      workerNotesEditorReducer(editing, {
        type: "finish",
        mode: "idle",
      })
    ).toEqual(initialWorkerNotesEditorState)
  })
})
