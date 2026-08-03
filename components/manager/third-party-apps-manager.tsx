"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarSync, CheckCircle2, RefreshCw, Unplug } from "lucide-react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { T } from "@/components/translated-text"
import { useOperations } from "@/components/providers/operations-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/convex/_generated/api"
import {
  useAppErrorTranslation,
  useAppTranslations,
} from "@/i18n/use-app-translations"
import type { AppMessageKey } from "@/i18n/messages"
import {
  DEPUTY_SYNC_LOOKAHEAD_DAYS,
  DEPUTY_SYNC_LOOKBACK_DAYS,
  DEPUTY_SYNC_MAX_ROSTERS,
} from "@/lib/deputy"

export function ThirdPartyAppsManager() {
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
  const searchParams = useSearchParams()
  const { hub } = useOperations()
  const connection = useQuery(
    api.deputy.getConnection,
    hub ? { hubId: hub.id } : "skip"
  )
  const requestSync = useMutation(api.deputy.requestSync)
  const disconnect = useMutation(api.deputy.disconnect)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const oauthFailed = searchParams.get("deputy") === "error"
  const oauthErrorValue = searchParams.get("error")
  const oauthError = (
    [
      "notAuthenticated",
      "missingSessionToken",
      "workplaceOwnerAccessRequired",
      "deputyIntegrationNotConfigured",
      "deputyOAuthInvalid",
      "deputyOAuthExchangeFailed",
      "deputyOAuthValidationFailed",
    ] as const
  ).find((key) => key === oauthErrorValue)

  async function syncNow() {
    if (!hub) return
    setSyncing(true)
    try {
      await requestSync({ hubId: hub.id })
      toast.success(t("deputySyncStarted"))
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      setSyncing(false)
    }
  }

  async function disconnectDeputy() {
    if (!hub) return
    setDisconnecting(true)
    try {
      await disconnect({ hubId: hub.id })
      setDisconnectOpen(false)
      toast.success(t("deputyDisconnected"))
    } catch (error) {
      toast.error(translateError(error))
    } finally {
      setDisconnecting(false)
    }
  }

  function connectDeputy() {
    window.location.assign("/api/integrations/deputy/connect")
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="thirdPartyApps"
        description="connectWorkplaceToolsKeepInformationInSync"
      />

      {oauthFailed && (
        <div
          role="alert"
          className="border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          {t(oauthError ?? "deputyOAuthExchangeFailed")}
        </div>
      )}

      <Card className="shadow-none">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center bg-primary/10 text-primary">
                <CalendarSync className="size-5" />
              </span>
              <div>
                <CardTitle>Deputy</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  <T>deputyEmployeeSchedulesDescription</T>
                </p>
              </div>
            </div>
            {connection && (
              <Badge
                variant={
                  connection.status === "error" ? "outline" : "secondary"
                }
              >
                {connection.status === "syncing" ? (
                  <RefreshCw className="animate-spin" />
                ) : (
                  <CheckCircle2 />
                )}
                {connection.status === "syncing" ? (
                  <T>syncing</T>
                ) : connection.status === "error" ? (
                  <T>needsAttention</T>
                ) : (
                  <T>connected</T>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-warning">
            <T
              values={{
                pastDays: DEPUTY_SYNC_LOOKBACK_DAYS,
                futureDays: DEPUTY_SYNC_LOOKAHEAD_DAYS,
                limit: DEPUTY_SYNC_MAX_ROSTERS,
              }}
            >
              deputySyncScopeMessage
            </T>
          </p>
          {connection === undefined ? (
            <p role="status" className="text-sm text-muted-foreground">
              <T>loadingIntegration</T>
            </p>
          ) : connection === null ? (
            <>
              <div className="max-w-2xl space-y-2 text-sm text-muted-foreground">
                <p>
                  <T>deputyConnectOnceBackgroundSyncMessage</T>
                </p>
                <p>
                  <T>deputySchedulesPrivateByDefaultMessage</T>
                </p>
              </div>
              <Button onClick={connectDeputy}>
                <CalendarSync /> <T>connectDeputy</T>
              </Button>
            </>
          ) : (
            <>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold">
                    <T>deputyInstallation</T>
                  </dt>
                  <dd className="mt-1 text-muted-foreground">
                    {connection.endpoint}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold">
                    <T>lastScheduleSync</T>
                  </dt>
                  <dd className="mt-1 text-muted-foreground">
                    {connection.lastSyncedAt
                      ? new Intl.DateTimeFormat(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(connection.lastSyncedAt)
                      : t("waitingForFirstSync")}
                  </dd>
                </div>
              </dl>
              {connection.lastSyncError && (
                <div
                  role="alert"
                  className="border border-destructive/30 bg-destructive/5 p-3 text-sm"
                >
                  <p className="font-semibold text-destructive">
                    <T>deputyCouldNotSync</T>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {t(connection.lastSyncError as AppMessageKey)}
                  </p>
                </div>
              )}
              <p className="max-w-2xl text-sm text-muted-foreground">
                <T>deputyControlsScheduleWorkhalControlsPrivacyMessage</T>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void syncNow()}
                  disabled={syncing || connection.status === "syncing"}
                >
                  <RefreshCw /> <T>syncNow</T>
                </Button>
                <Button variant="outline" onClick={connectDeputy}>
                  <CalendarSync /> <T>reconnect</T>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDisconnectOpen(true)}
                >
                  <Unplug /> <T>disconnect</T>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <T>disconnectDeputy</T>
            </DialogTitle>
            <DialogDescription>
              <T>disconnectDeputyStopsUpdatesKeepsSchedulesMessage</T>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              <T>cancel</T>
            </Button>
            <Button
              variant="destructive"
              onClick={() => void disconnectDeputy()}
              disabled={disconnecting}
            >
              <T>{disconnecting ? "disconnecting" : "disconnect"}</T>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
