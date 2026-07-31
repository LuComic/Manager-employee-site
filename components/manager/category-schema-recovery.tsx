"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { AlertTriangle, CheckCircle2, DatabaseBackup } from "lucide-react"
import { toast } from "sonner"

import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/convex/_generated/api"
import {
  useAppErrorTranslation,
  useAppTranslations,
} from "@/i18n/use-app-translations"

export function CategorySchemaRecovery() {
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
  const { hub, managerAccess } = useOperations()
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)
  const status = useQuery(
    api.categoryRecovery.getStatus,
    hub && managerAccess === "owner" ? { hubId: hub.id } : "skip"
  )
  const recover = useMutation(api.categoryRecovery.run)

  if (!hub || managerAccess !== "owner" || status === undefined) return null
  if (!status.needed && !completed) return null

  if (!status.needed && completed) {
    return (
      <Card className="border-primary/30 shadow-none">
        <CardHeader>
          <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
            <CheckCircle2 className="size-5" />
          </span>
          <CardTitle className="mt-4 text-base">
            {t("categoryRecoveryComplete")}
          </CardTitle>
          <CardDescription>
            {t("categoryRecoveryCompleteDescription")}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const categoryIssues =
    status.categoriesNeedingKindRepair + status.categoriesWithSystemLabel

  return (
    <Card className="border-warning/40 shadow-none">
      <CardHeader>
        <span className="flex size-10 items-center justify-center bg-warning/15 text-warning">
          <AlertTriangle className="size-5" />
        </span>
        <CardTitle className="mt-4 text-base">
          {t("categoryDataRecovery")}
        </CardTitle>
        <CardDescription>
          {t("categoryDataRecoveryDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("categoryDataRecoverySummary", {
            categoryCount: categoryIssues,
            eventCount: status.eventsNeedingCategoryRepair,
            defaultCount: status.retiredDefaultEventTypes,
          })}
        </p>
        {status.missingReservation && (
          <p className="text-sm text-muted-foreground">
            {t("categoryRecoveryWillCreateReservation")}
          </p>
        )}
        {status.blocked ? (
          <p role="alert" className="text-sm text-destructive">
            {t("categoryRecoveryBlockedDescription")}
          </p>
        ) : (
          <Button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true)
              try {
                await recover({ hubId: hub.id })
                setCompleted(true)
                toast.success(t("categoryRecoveryComplete"))
              } catch (error) {
                toast.error(translateError(error))
              } finally {
                setPending(false)
              }
            }}
          >
            <DatabaseBackup />
            {t(pending ? "runningCategoryRecovery" : "runCategoryRecovery")}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
