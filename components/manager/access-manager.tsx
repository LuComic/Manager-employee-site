"use client"

import { T } from "@/components/translated-text"

import { useState } from "react"
import { useQuery } from "convex/react"
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
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
import type { AppMessageKey } from "@/i18n/messages"

export function AccessManager() {
  const { hub, managerAccess, rotateCredentials, setAccessMode, showFeedback } =
    useOperations()
  const [pending, setPending] = useState(false)
  const [modePending, setModePending] = useState(false)
  const [copied, setCopied] = useState("")
  const credentials = useQuery(
    api.hubs.getOwnerCredentials,
    hub && managerAccess === "owner" ? { hubId: hub.id } : "skip"
  )
  if (!hub) return null

  const credentialsLoading = credentials === undefined
  const employeeUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/?hub=${encodeURIComponent(hub.slug)}`
  const privateUrl = credentials
    ? `${employeeUrl}#access=${encodeURIComponent(credentials.privateToken)}`
    : ""

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(label)
    window.setTimeout(() => setCopied(""), 1800)
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="employeeAccess"
        description="controlAccountlessAccessPublishedHubContentJoinMessage"
      />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-5 text-primary" /> <T>accessMode</T>
          </CardTitle>
          <CardDescription>
            <T>publicModeOpensPublishedContentAnyoneWorkplaceMessage</T>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <Button
            role="switch"
            aria-checked={hub.accessMode === "restricted"}
            variant={hub.accessMode === "restricted" ? "default" : "outline"}
            disabled={modePending}
            onClick={async () => {
              const nextMode =
                hub.accessMode === "restricted" ? "public" : "restricted"
              setModePending(true)
              try {
                await setAccessMode(nextMode)
                showFeedback(
                  nextMode === "restricted"
                    ? "restrictedAccessEnabledEmployeesNowNeedCodeMessage"
                    : "publicAccessEnabledWorkplaceurlNowOpensMessage"
                )
              } finally {
                setModePending(false)
              }
            }}
          >
            <ShieldCheck />
            <T>
              {hub.accessMode === "restricted"
                ? "restrictedAccessOn"
                : "requireCodeOrPrivateLink"}
            </T>
          </Button>
          <p className="text-sm text-muted-foreground">
            <T>currentMode</T>{" "}
            <span className="font-medium text-foreground">
              <T>{hub.accessMode === "restricted" ? "restricted" : "public"}</T>
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <CredentialCard
          icon={KeyRound}
          title="employeeJoinCode"
          value={credentials?.joinCode ?? ""}
          loading={credentialsLoading}
          disabled={credentialsLoading}
          copied={copied === "code"}
          onCopy={() => copy("code", credentials?.joinCode ?? "")}
          description="shareShortCodeVerballyStaffOnlyChannel"
        />
        <CredentialCard
          icon={Link2}
          title="privateJoinLink"
          value={privateUrl}
          loading={credentialsLoading}
          disabled={credentialsLoading}
          copied={copied === "link"}
          onCopy={() => copy("link", privateUrl)}
          description="openingLinkGrantsAccessWithoutTypingCode"
        />
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">
            <T>rotateOrRevokeAccess</T>
          </CardTitle>
          <CardDescription>
            <T>rotationImmediatelyInvalidatesPreviousCodeLinkIncludingError</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            disabled={pending || credentialsLoading}
            onClick={async () => {
              setPending(true)
              try {
                await rotateCredentials()
                showFeedback("joinCodeAndPrivateLinkRotated")
              } finally {
                setPending(false)
              }
            }}
          >
            <RefreshCw /> <T>rotateCodeAndLink</T>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function CredentialCard({
  icon: Icon,
  title,
  value,
  description,
  loading,
  disabled,
  copied,
  onCopy,
}: {
  icon: typeof KeyRound
  title: AppMessageKey
  value: string
  description: AppMessageKey
  loading: boolean
  disabled: boolean
  copied: boolean
  onCopy: () => void
}) {
  const [revealed, setRevealed] = useState(false)

  return (
    <Card className="shadow-none">
      <CardHeader>
        <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
          <Icon />
        </span>
        <CardTitle className="mt-3 text-base">
          <T>{title}</T>
        </CardTitle>
        <CardDescription>
          <T>{description}</T>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <code className="block overflow-x-auto border bg-muted/40 p-3 text-xs">
          {loading ? (
            <T>loadingAccessCredentials</T>
          ) : value ? (
            revealed ? (
              value
            ) : (
              "••••••••••••"
            )
          ) : null}
        </code>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onCopy}
          >
            {copied ? <Check /> : <Copy />} <T>{copied ? "copied" : "copy"}</T>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={revealed}
            disabled={disabled}
            onClick={() => setRevealed((current) => !current)}
          >
            {revealed ? <EyeOff /> : <Eye />}
            <T>{revealed ? "hide" : "show"}</T>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
