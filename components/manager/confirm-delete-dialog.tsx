"use client"

import { T } from "@/components/translated-text"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ConfirmDeleteDialog({
  open,
  title,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <T>Delete “</T>
            {title}”?
          </DialogTitle>
          <DialogDescription>
            <T>
              This permanently removes the item from the hub. This action cannot
              be undone.
            </T>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            <T>Cancel</T>
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            <T>Delete</T>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
