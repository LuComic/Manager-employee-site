"use client"

import { T } from "@/components/translated-text"
import { useAppTranslations, useLanguageTag } from "@/i18n/use-app-translations"

import { useState } from "react"
import { CheckCircle2, Headphones, RotateCcw, Trash2 } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/manager/confirm-delete-dialog"
import { ManagerHeading } from "@/components/manager/manager-heading"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

type HelpRequest = {
  id: Id<"helpRequests">
  topic: string
  message: string
  submittedAt: number
  status: "open" | "resolved"
}

export function HelpRequestManager() {
  const t = useAppTranslations()
  const languageTag = useLanguageTag()
  const { hub } = useOperations()
  const requests = useQuery(
    api.content.listHelpRequests,
    hub ? { hubId: hub.id } : "skip"
  ) as HelpRequest[] | undefined
  const setStatus = useMutation(api.content.setHelpRequestStatus)
  const remove = useMutation(api.content.deleteHelpRequest)
  const [filter, setFilter] = useState<"open" | "resolved">("open")
  const [deleteTarget, setDeleteTarget] = useState<HelpRequest | null>(null)
  const visible = requests?.filter((request) => request.status === filter) ?? []

  async function updateStatus(request: HelpRequest) {
    if (!hub) return
    const status = request.status === "open" ? "resolved" : "open"
    try {
      await setStatus({ hubId: hub.id, requestId: request.id, status })
      toast.success(
        t(status === "resolved" ? "Request resolved." : "Request reopened.")
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? t(error.message)
          : t("Could not update request")
      )
    }
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Help requests"
        description="Review questions employees sent from the help button."
      />

      <div className="border-b pb-4">
        <SegmentedControl aria-label="Help request status">
          {(["open", "resolved"] as const).map((status) => (
            <SegmentedControlItem
              key={status}
              selected={filter === status}
              size="sm"
              onClick={() => setFilter(status)}
            >
              <T>{status === "open" ? "Open" : "Resolved"}</T>
              <Badge variant="outline">
                {requests?.filter((request) => request.status === status)
                  .length ?? 0}
              </Badge>
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>

      {requests === undefined ? (
        <p className="text-sm text-muted-foreground" role="status">
          <T>Loading help requests…</T>
        </p>
      ) : visible.length ? (
        <div className="space-y-4">
          {visible.map((request) => (
            <Card key={request.id} size="sm" className="shadow-none">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <Headphones className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{request.topic}</h2>
                    <span aria-hidden="true" className="text-border">
                      |
                    </span>
                    <Badge
                      variant={
                        request.status === "open" ? "secondary" : "outline"
                      }
                    >
                      <T>{request.status === "open" ? "Open" : "Resolved"}</T>
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                    {request.message}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat(languageTag, {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: hub?.timeZone,
                    }).format(request.submittedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void updateStatus(request)}
                  >
                    {request.status === "open" ? (
                      <CheckCircle2 />
                    ) : (
                      <RotateCcw />
                    )}
                    <T>{request.status === "open" ? "Resolve" : "Reopen"}</T>
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(request)}
                    aria-label={t("Delete {name}", { name: request.topic })}
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
          icon={filter === "open" ? Headphones : CheckCircle2}
          title={
            filter === "open" ? "No open help requests" : "No resolved requests"
          }
          description={
            filter === "open"
              ? "New employee questions will appear here."
              : "Requests you resolve will appear here."
          }
        />
      )}

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.topic ?? "help request"}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={async () => {
          if (!hub || !deleteTarget) return
          await remove({ hubId: hub.id, requestId: deleteTarget.id })
          toast.success("Help request deleted.")
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
