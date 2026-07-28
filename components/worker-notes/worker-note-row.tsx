import type { FunctionReturnType } from "convex/server"
import { Pin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { api } from "@/convex/_generated/api"
import { cn } from "@/lib/utils"

export const NOTE_ROW_CLASS =
  "flex w-full items-start gap-3 border border-transparent px-2 py-1 text-left text-sm leading-6"
export const ENTRY_BULLET_CLASS = "mt-2 size-1.5 shrink-0 rounded-full"

export type WorkerNote = FunctionReturnType<
  typeof api.workerNotes.list
>["notes"][number]

export function NotePinButton({
  label,
  note,
  pending,
  onSetPinned,
}: {
  label: string
  note: WorkerNote
  pending: boolean
  onSetPinned: (note: WorkerNote) => Promise<void>
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "absolute top-1 right-1 z-10 size-6 opacity-0 transition-opacity group-focus-within/note:opacity-100 group-hover/note:opacity-100 hover:border-none! hover:bg-transparent!",
        note.pinned && "opacity-100"
      )}
      aria-label={label}
      disabled={pending}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void onSetPinned(note)
      }}
    >
      <Pin
        className={cn(
          "size-4",
          note.pinned ? "fill-primary text-primary" : "text-muted-foreground"
        )}
        aria-hidden="true"
      />
    </Button>
  )
}
