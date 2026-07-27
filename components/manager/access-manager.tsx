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
        title="Employee access"
        description="Control accountless access to published hub content. Join codes and private links are bearer credentials."
      />
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-5 text-primary" /> <T>Access mode</T>
          </CardTitle>
          <CardDescription>
            <T>
              Public mode opens published content to anyone with the workplace
              URL. Restricted mode requires the employee join code or private
              link. Signed-in workplace members keep their normal access.
            </T>
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
                ? "Restricted access on"
                : "Require code or private link"}
            </T>
          </Button>
          <p className="text-sm text-muted-foreground">
            <T>Current mode:</T>{" "}
            <span className="font-medium text-foreground">
              <T>{hub.accessMode === "restricted" ? "Restricted" : "Public"}</T>
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
            <T>Rotate or revoke access</T>
          </CardTitle>
          <CardDescription>
            <T>
              Rotation immediately invalidates the previous code and link,
              including copies remembered by employee browsers. Only credential
              hashes are stored in Convex; the readable values are kept in this
              owner’s browser.
            </T>
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
                showFeedback("Join code and private link rotated.")
              } finally {
                setPending(false)
              }
            }}
          >
            <RefreshCw /> <T>Rotate code and link</T>
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
          {copied ? <Check /> : <Copy />} <T>{copied ? "Copied" : "Copy"}</T>
        </Button>
      </CardContent>
    </Card>
  )
}
