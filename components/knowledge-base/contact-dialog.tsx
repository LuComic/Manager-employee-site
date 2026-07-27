"use client"

import { T } from "@/components/translated-text"

import { createContext, useContext, useState } from "react"
import { ArrowRight, CheckCircle2, Headphones, Mail, Phone } from "lucide-react"

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
import { useAppTranslations } from "@/i18n/use-app-translations"
import { getCustomContactName } from "@/lib/contact"
import { cn } from "@/lib/utils"
import { useOperations } from "@/components/providers/operations-provider"

const ContactContext = createContext<() => void>(() => undefined)

export function ContactProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [topic, setTopic] = useState("")
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState(false)
  const { hub, submitHelpRequest } = useOperations()
  const t = useAppTranslations()
  const customContactName = getCustomContactName(hub?.contactName)
  const contactName = customContactName ?? t("shiftLead")

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
                <T>questionSent</T>
              </DialogTitle>
              <DialogDescription className="mt-2">
                {customContactName
                  ? t("noteSentToContact", { contactName })
                  : t("noteSentToShiftLead")}
              </DialogDescription>
              <Button className="mt-6" onClick={() => handleOpenChange(false)}>
                <T>done</T>
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
                  {customContactName
                    ? t("askContact", { contactName })
                    : t("askShiftLead")}
                </DialogTitle>
                <DialogDescription>
                  <T>sendQuickNoteAnythingUrgentRelatedSafetyMessage</T>
                </DialogDescription>
              </DialogHeader>
              {(hub?.contactEmail || hub?.contactPhone) && (
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {hub.contactEmail && (
                    <a
                      href={`mailto:${hub.contactEmail}`}
                      className="flex items-center gap-2 underline underline-offset-4 hover:text-foreground"
                    >
                      <Mail className="size-4" /> {hub.contactEmail}
                    </a>
                  )}
                  {hub.contactPhone && (
                    <a
                      href={`tel:${hub.contactPhone}`}
                      className="flex items-center gap-2 underline underline-offset-4 hover:text-foreground"
                    >
                      <Phone className="size-4" /> {hub.contactPhone}
                    </a>
                  )}
                </div>
              )}
              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">
                    <T>topic</T>
                  </Label>
                  <Input
                    id="topic"
                    required
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="forExampleRefundApproval"
                    className="border border-input px-3 focus-visible:border-ring"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">
                    <T>question</T>
                  </Label>
                  <Textarea
                    id="message"
                    required
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="describeWhatYouNeedHelpWith"
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
                  <T>cancel</T>
                </Button>
                <Button type="submit" disabled={pending}>
                  <T>{pending ? "sending" : "sendQuestion"}</T> <ArrowRight />
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
  const { hub } = useOperations()
  const t = useAppTranslations()
  const customContactName = getCustomContactName(hub?.contactName)
  const contactLabel = customContactName
    ? t("contactContact", { contactName: customContactName })
    : t("contactShiftLead")

  return (
    <Button
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className={cn(!compact && "gap-2 tracking-normal normal-case", className)}
      onClick={() => {
        onBeforeOpen?.()
        openContact()
      }}
      aria-label={compact ? contactLabel : undefined}
    >
      <Headphones />
      {!compact && contactLabel}
    </Button>
  )
}
