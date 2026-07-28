import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useReducer,
  useRef,
} from "react"
import { useMutation } from "convex/react"
import { toast } from "sonner"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAppErrorTranslation } from "@/i18n/use-app-translations"

import {
  initialWorkerNotesEditorState,
  workerNotesEditorReducer,
} from "./worker-notes-editor-state"
import type { WorkerNote } from "./worker-note-row"

type EditDestination = WorkerNote | "new" | null

export function useWorkerNotesEditor({
  hubId,
  notes,
}: {
  hubId: Id<"hubs"> | undefined
  notes: WorkerNote[] | undefined
}) {
  const translateError = useAppErrorTranslation()
  const createNote = useMutation(api.workerNotes.create)
  const updateNoteText = useMutation(api.workerNotes.updateText)
  const [editor, dispatchEditor] = useReducer(
    workerNotesEditorReducer,
    initialWorkerNotesEditorState
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const createSaveRef = useRef<{
    revision: number
    closeAfterSave: boolean
  } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const editSaveRef = useRef<{
    revision: number
    destination: EditDestination
  } | null>(null)
  const cancelEditRef = useRef(false)
  const isWriting = editor.mode === "creating"
  const editingNoteId = editor.editingNoteId

  useEffect(() => {
    if (!isWriting) return
    inputRef.current?.focus()
  }, [isWriting])

  useEffect(() => {
    if (!editingNoteId) return
    const input = editInputRef.current
    if (!input) return
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  }, [editingNoteId, editor.revision])

  useEffect(() => {
    if (
      editor.mode !== "editing" ||
      notes === undefined ||
      notes.some((note) => note.id === editor.editingNoteId)
    ) {
      return
    }
    const timeout = window.setTimeout(() => {
      dispatchEditor({ type: "noteDisappeared" })
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [editor.editingNoteId, editor.mode, notes])

  async function saveNewNote(closeAfterSave: boolean) {
    if (!hubId) return
    const pendingSave = createSaveRef.current
    if (pendingSave) {
      if (closeAfterSave) pendingSave.closeAfterSave = true
      return
    }

    const text = editor.draft.trim()
    if (!text) {
      if (closeAfterSave) {
        dispatchEditor({
          type: "finishIfCurrent",
          revision: editor.revision,
          mode: "idle",
        })
      }
      return
    }

    const save = {
      revision: editor.revision,
      closeAfterSave,
    }
    createSaveRef.current = save
    dispatchEditor({
      type: "setSaving",
      revision: save.revision,
      saving: true,
    })
    try {
      await createNote({ hubId, text })
      dispatchEditor({
        type: "finishIfCurrent",
        revision: save.revision,
        mode: save.closeAfterSave ? "idle" : "creating",
      })
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      if (createSaveRef.current === save) createSaveRef.current = null
      dispatchEditor({
        type: "setSaving",
        revision: save.revision,
        saving: false,
      })
    }
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void saveNewNote(false)
  }

  function beginEditing(note: WorkerNote) {
    cancelEditRef.current = false
    dispatchEditor({
      type: "beginEditing",
      noteId: note.id,
      text: note.text,
    })
  }

  async function saveEditedNote(text: string, destination: EditDestination) {
    if (!hubId || !editingNoteId) return
    const pendingSave = editSaveRef.current
    if (pendingSave) {
      if (destination) pendingSave.destination = destination
      return
    }

    const noteId = editingNoteId
    const expectedText = editor.originalText
    const save = {
      revision: editor.revision,
      destination,
    }
    editSaveRef.current = save
    dispatchEditor({
      type: "setSaving",
      revision: save.revision,
      saving: true,
    })
    try {
      const result = await updateNoteText({
        hubId,
        noteId,
        text,
        expectedText,
      })
      if (result.status === "conflict") {
        dispatchEditor({
          type: "reconcileConflict",
          revision: save.revision,
          currentText: result.currentText,
        })
      } else if (save.destination && save.destination !== "new") {
        beginEditing(save.destination)
      } else {
        dispatchEditor({
          type: "finishIfCurrent",
          revision: save.revision,
          mode: save.destination === "new" ? "creating" : "idle",
        })
      }
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      if (editSaveRef.current === save) editSaveRef.current = null
      dispatchEditor({
        type: "setSaving",
        revision: save.revision,
        saving: false,
      })
    }
  }

  function finishEditing(openNewLine: boolean) {
    return saveEditedNote(editor.draft, openNewLine ? "new" : null)
  }

  function deleteEditingNoteAndMoveUp(note: WorkerNote) {
    const noteIndex = notes?.findIndex((item) => item.id === note.id) ?? -1
    const previousNote =
      noteIndex > 0 && notes ? notes[noteIndex - 1] : undefined
    return saveEditedNote("", previousNote ?? "new")
  }

  function handleNewNoteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      dispatchEditor({ type: "finish", mode: "idle" })
      return
    }
    if (
      (event.key !== "Backspace" && event.key !== "ArrowUp") ||
      editor.draft
    ) {
      return
    }
    const previousNote = notes ? notes[notes.length - 1] : undefined
    if (!previousNote) return
    event.preventDefault()
    beginEditing(previousNote)
  }

  function handleEditingKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    note: WorkerNote
  ) {
    if (event.key === "Escape") {
      cancelEditRef.current = true
      editSaveRef.current = null
      dispatchEditor({ type: "finish", mode: "creating" })
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      void finishEditing(true)
      return
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const noteIndex = notes?.findIndex((item) => item.id === note.id) ?? -1
      const destination =
        event.key === "ArrowUp"
          ? noteIndex > 0 && notes
            ? notes[noteIndex - 1]
            : null
          : notes && noteIndex >= 0 && noteIndex < notes.length - 1
            ? notes[noteIndex + 1]
            : "new"
      if (!destination) return
      event.preventDefault()
      void saveEditedNote(editor.draft, destination)
      return
    }
    if (event.key !== "Backspace" || editor.draft) return
    event.preventDefault()
    void deleteEditingNoteAndMoveUp(note)
  }

  function activateNote(note: WorkerNote) {
    if (editInputRef.current) {
      void saveEditedNote(editor.draft, note)
      return
    }
    beginEditing(note)
  }

  return {
    editor,
    isWriting,
    editingNoteId,
    inputRef,
    editInputRef,
    startCreating: () => dispatchEditor({ type: "startCreating" }),
    changeDraft: (draft: string) =>
      dispatchEditor({ type: "changeDraft", draft }),
    submitNote,
    saveNewNote,
    finishEditing,
    handleNewNoteKeyDown,
    handleEditingKeyDown,
    handleEditingBlur: () => {
      if (!cancelEditRef.current) void finishEditing(false)
    },
    activateNote,
  }
}
