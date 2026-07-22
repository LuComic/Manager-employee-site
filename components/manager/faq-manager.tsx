"use client"

import { useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  CircleHelp,
  FilePenLine,
  Plus,
  Trash2,
} from "lucide-react"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { slugify, type Faq } from "@/lib/operations"

export function FaqManager() {
  const { faqs, saveFaq, moveFaq, deleteFaq, showFeedback } = useOperations()
  const [editing, setEditing] = useState<Faq | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (!editing) return
    const question = editing.question.trim()
    const answer = editing.answer.trim()
    if (!question || !answer) {
      setError("Add both a question and an answer.")
      return
    }
    let id = editing.id
    if (!id) {
      const base = slugify(question) || "question"
      id = base
      let suffix = 2
      while (faqs.some((faq) => faq.id === id)) {
        id = `${base}-${suffix}`
        suffix += 1
      }
    }

    setPending(true)
    try {
      await saveFaq({ ...editing, id, question, answer })
      showFeedback(editing.id ? "Question saved." : "Question created.")
      setEditing(null)
      setError("")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Common questions"
        description="Manage the quick answers employees see on the questions page and in search."
        action={
          <Button
            onClick={() => {
              setEditing({
                id: "",
                question: "",
                answer: "",
                order: faqs.length,
                published: true,
              })
              setError("")
            }}
          >
            <Plus /> New question
          </Button>
        }
      />

      {faqs.length ? (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <Card key={faq.id} size="sm" className="shadow-none">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <CircleHelp className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{faq.question}</h2>
                    <Badge variant={faq.published ? "secondary" : "outline"}>
                      {faq.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {faq.answer}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => moveFaq(faq.id, -1)}
                    aria-label={`Move ${faq.question} up`}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={index === faqs.length - 1}
                    onClick={() => moveFaq(faq.id, 1)}
                    aria-label={`Move ${faq.question} down`}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await saveFaq({ ...faq, published: !faq.published })
                      showFeedback(
                        faq.published
                          ? "Question unpublished."
                          : "Question published."
                      )
                    }}
                  >
                    {faq.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing({ ...faq })
                      setError("")
                    }}
                  >
                    <FilePenLine /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(faq)}
                    aria-label={`Delete ${faq.question}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CircleHelp}
          title="No common questions"
          description="Add the answers employees need most often."
        />
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setError("")
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          {editing && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              <DialogHeader>
                <DialogTitle>
                  {editing.id ? "Edit question" : "Create question"}
                </DialogTitle>
                <DialogDescription>
                  Published answers appear immediately on the employee site.
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="faq-question">Question</Label>
                  <Textarea
                    id="faq-question"
                    value={editing.question}
                    onChange={(event) =>
                      setEditing((current) =>
                        current
                          ? { ...current, question: event.target.value }
                          : current
                      )
                    }
                    className="min-h-20 border border-input px-3"
                    maxLength={300}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faq-answer">Answer</Label>
                  <Textarea
                    id="faq-answer"
                    value={editing.answer}
                    onChange={(event) =>
                      setEditing((current) =>
                        current
                          ? { ...current, answer: event.target.value }
                          : current
                      )
                    }
                    className="min-h-36 border border-input px-3"
                    maxLength={4000}
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save question"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.question ?? "question"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteFaq(deleteTarget.id)
          showFeedback("Question deleted.")
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
