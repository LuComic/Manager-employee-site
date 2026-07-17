"use client"

import { useState } from "react"
import { KeyRound, LoaderCircle, LogOut, ShieldCheck } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function HubAccessGate({ children }: { children: React.ReactNode }) {
  const { hub, hubState, credential, grantAnonymousAccess, leaveHub } =
    useOperations()
  const [code, setCode] = useState("")

  if (hubState === "loading") {
    return (
      <div
        className="flex min-h-svh items-center justify-center bg-muted/40"
        role="status"
      >
        <LoaderCircle className="size-6 animate-spin text-primary" />
        <span className="sr-only">Loading hub</span>
      </div>
    )
  }

  if (hubState === "not-found") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader>
            <CardTitle>Hub not found</CardTitle>
            <CardDescription>
              Check the hub address or ask your manager for the current employee
              link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (hubState === "restricted") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader>
            <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary">
              <ShieldCheck />
            </span>
            <CardTitle>{hub?.name ?? "Private operations hub"}</CardTitle>
            <CardDescription>
              Enter the employee join code. You do not need an account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (code.trim()) grantAnonymousAccess(code)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="join-code">Employee join code</Label>
                <Input
                  id="join-code"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  placeholder="XXXX-XXXX"
                  autoComplete="one-time-code"
                  className="border border-input px-3 font-mono uppercase"
                  required
                />
              </div>
              {credential && (
                <p role="alert" className="text-sm text-destructive">
                  That code or private link is invalid, expired, or has been
                  rotated.
                </p>
              )}
              <Button type="submit" className="w-full">
                <KeyRound /> Open hub
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <>
      {children}
      {hub?.accessMode === "restricted" && credential && (
        <Button
          variant="outline"
          size="sm"
          className="fixed right-4 bottom-4 z-40 bg-background shadow-sm"
          onClick={leaveHub}
        >
          <LogOut /> Leave hub
        </Button>
      )}
    </>
  )
}
