"use client"

import { T } from "@/components/translated-text"

import { useState } from "react"
import {
  Check,
  Copy,
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

export function AccessManager() {
  const {
    hub,
    ownerCredentials,
    rotateCredentials,
    setAccessMode,
    showFeedback,
  } = useOperations()
  const [pending, setPending] = useState(false)
  const [modePending, setModePending] = useState(false)
  const [copied, setCopied] = useState("")
  if (!hub) return null

  const employeeUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/?hub=${encodeURIComponent(hub.slug)}`
  const privateUrl = ownerCredentials
    ? `${employeeUrl}#access=${encodeURIComponent(ownerCredentials.privateToken)}`
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
                    ? "Restricted access enabled. Employees now need the code or private link."
                    : "Public access enabled. The workplace URL now opens without a code."
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
          title="Employee join code"
          value={ownerCredentials?.joinCode ?? "Not stored in this browser"}
          disabled={!ownerCredentials}
          copied={copied === "code"}
          onCopy={() => copy("code", ownerCredentials?.joinCode ?? "")}
          description="Share this short code verbally or in a staff-only channel."
        />
        <CredentialCard
          icon={Link2}
          title="Private join link"
          value={privateUrl || "Not stored in this browser"}
          disabled={!ownerCredentials}
          copied={copied === "link"}
          onCopy={() => copy("link", privateUrl)}
          description="Opening this link grants access without typing the code."
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
            disabled={pending}
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
  disabled,
  copied,
  onCopy,
}: {
  icon: typeof KeyRound
  title: string
  value: string
  description: string
  disabled: boolean
  copied: boolean
  onCopy: () => void
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
          <Icon />
        </span>
        <CardTitle className="mt-3 text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <code className="block overflow-x-auto border bg-muted/40 p-3 text-xs">
          {value}
        </code>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={disabled}
          onClick={onCopy}
        >
          {copied ? <Check /> : <Copy />} <T>{copied ? "copied" : "copy"}</T>
        </Button>
      </CardContent>
    </Card>
  )
}
