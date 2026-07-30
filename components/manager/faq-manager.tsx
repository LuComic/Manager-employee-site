"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations } from "@/i18n/use-app-translations"

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
  const t = useAppTranslations()
  const { faqs, canCreateContent, saveFaq, moveFaq, deleteFaq, showFeedback } =
    useOperations()
  const [editing, setEditing] = useState<Faq | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    if (!editing) return
    const question = editing.question.trim()
    const answer = editing.answer.trim()
    if (!question || !answer) {
      setError("addBothQuestionAnswer")
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
      showFeedback(editing.id ? "questionSaved" : "questionCreated")
      setEditing(null)
      setError("")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="commonQuestions"
        description="manageQuickAnswersEmployeesSeeQuestionsPageMessage"
        action={
          canCreateContent ? (
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
              <Plus /> <T>createQuestion</T>
            </Button>
          ) : undefined
        }
      />

      {faqs.length ? (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <Card
              id={`question-${faq.id}`}
              key={faq.id}
              size="sm"
              className="scroll-mt-6 shadow-none target:ring-2 target:ring-ring/30"
            >
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <CircleHelp className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{faq.question}</h2>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge variant={faq.published ? "secondary" : "outline"}>
                      <T>{faq.published ? "published" : "draft"}</T>
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
                    aria-label={t("moveNameUp", { name: faq.question })}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={index === faqs.length - 1}
                    onClick={() => moveFaq(faq.id, 1)}
                    aria-label={t("moveNameDown", { name: faq.question })}
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
                          ? "questionUnpublished"
                          : "questionPublished"
                      )
                    }}
                  >
                    <T>{faq.published ? "unpublish" : "publish"}</T>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing({ ...faq })
                      setError("")
                    }}
                  >
                    <FilePenLine /> <T>edit</T>
                  </Button>
                  {canCreateContent && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(faq)}
                      aria-label={t("deleteName", { name: faq.question })}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CircleHelp}
          title="noCommonQuestions"
          description="addAnswersEmployeesNeedMostOften"
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
                  <T>{editing.id ? "editQuestion" : "createQuestion"}</T>
                </DialogTitle>
                <DialogDescription>
                  <T>publishedAnswersAppearImmediatelyEmployeeSite</T>
                </DialogDescription>
              </DialogHeader>
              <div className="my-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="faq-question">
                    <T>question</T>
                  </Label>
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
                  <Label htmlFor="faq-answer">
                    <T>answer</T>
                  </Label>
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
                    <T>{error}</T>
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  <T>cancel</T>
                </Button>
                <Button type="submit" disabled={pending}>
                  <T>{pending ? "saving" : "saveQuestion"}</T>
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
          showFeedback("questionDeleted")
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
