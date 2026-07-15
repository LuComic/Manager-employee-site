"use client"

import { createContext, useContext, useState } from "react"
import { ArrowRight, CheckCircle2, Headphones } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const ContactContext = createContext<() => void>(() => undefined)

export function ContactProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSent(false)
    }
  }

  return (
    <ContactContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          {sent ? (
            <div className="py-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center bg-primary/10 text-primary">
                <CheckCircle2 />
              </span>
              <DialogTitle className="mt-4 normal-case tracking-normal">Question sent</DialogTitle>
              <DialogDescription className="mt-2">
                The shift lead has the note and will come by shortly.
              </DialogDescription>
              <Button className="mt-6" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                setSent(true)
              }}
            >
              <DialogHeader>
                <DialogTitle className="normal-case tracking-normal">Ask the shift lead</DialogTitle>
                <DialogDescription>
                  Send a quick note. For anything urgent or related to safety, speak to someone in person.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">What is this about?</Label>
                  <Input
                    id="topic"
                    required
                    placeholder="For example: refund approval"
                    className="border border-input px-3 focus-visible:border-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Question</Label>
                  <Textarea
                    id="message"
                    required
                    placeholder="Describe what you need help with…"
                    className="min-h-28 border border-input px-3 focus-visible:border-ring"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Send question <ArrowRight />
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </ContactContext.Provider>
  )
}

export function ContactButton({
  className,
  compact = false,
  onBeforeOpen,
}: {
  className?: string
  compact?: boolean
  onBeforeOpen?: () => void
}) {
  const openContact = useContext(ContactContext)

  return (
    <Button
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className={cn(!compact && "gap-2 normal-case tracking-normal", className)}
      onClick={() => {
        onBeforeOpen?.()
        openContact()
      }}
      aria-label={compact ? "Contact shift lead" : undefined}
    >
      <Headphones />
      {!compact && "Contact shift lead"}
    </Button>
  )
}
