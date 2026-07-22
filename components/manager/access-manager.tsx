"use client"

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
  const { hub, ownerCredentials, rotateCredentials, showFeedback } =
    useOperations()
  const [pending, setPending] = useState(false)
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
            <ShieldCheck className="size-5 text-primary" /> Access mode
          </CardTitle>
          <CardDescription>
            The signed-in owner can always open and manage this hub.
          </CardDescription>
        </CardHeader>
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
          <CardTitle className="text-base">Rotate or revoke access</CardTitle>
          <CardDescription>
            Rotation immediately invalidates the previous code and link,
            including copies remembered by employee browsers. Only credential
            hashes are stored in Convex; the readable values are kept in this
            owner browser.
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
            <RefreshCw /> Rotate code and link
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
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </Button>
      </CardContent>
    </Card>
  )
}
