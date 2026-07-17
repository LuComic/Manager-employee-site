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
import { useOperations } from "@/components/providers/operations-provider"

const ContactContext = createContext<() => void>(() => undefined)

export function ContactProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [topic, setTopic] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const { submitHelpRequest } = useOperations()

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSent(false)
      setTopic("")
      setMessage("")
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
              <DialogTitle className="mt-4 tracking-normal normal-case">
                Question sent
              </DialogTitle>
              <DialogDescription className="mt-2">
                The shift lead has the note and will come by shortly.
              </DialogDescription>
              <Button className="mt-6" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </div>
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault()
                setPending(true)
                try {
                  await submitHelpRequest(topic, message)
                  setSent(true)
                } finally {
                  setPending(false)
                }
              }}
            >
              <DialogHeader>
                <DialogTitle className="tracking-normal normal-case">
                  Ask the shift lead
                </DialogTitle>
                <DialogDescription>
                  Send a quick note. For anything urgent or related to safety,
                  speak to someone in person.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">What is this about?</Label>
                  <Input
                    id="topic"
                    required
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="For example: refund approval"
                    className="border border-input px-3 focus-visible:border-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Question</Label>
                  <Textarea
                    id="message"
                    required
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe what you need help with…"
                    className="min-h-28 border border-input px-3 focus-visible:border-ring"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Sending…" : "Send question"} <ArrowRight />
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
      className={cn(!compact && "gap-2 tracking-normal normal-case", className)}
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
