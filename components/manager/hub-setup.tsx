"use client"

import { useState } from "react"
import Link from "next/link"
import {
  OrganizationSwitcher,
  useAuth,
  useClerk,
  useOrganization,
} from "@clerk/nextjs"
import { Building2, KeyRound, LoaderCircle } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { slugify } from "@/lib/operations"

const afterOrganizationCreated = "/manager"

export function HubSetup() {
  const { createHub } = useOperations()
  const { orgId } = useAuth()
  const { organization, isLoaded } = useOrganization()
  const { openCreateOrganization } = useClerk()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  if (!orgId) {
    return (
      <Card className="mx-auto max-w-xl shadow-none">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary">
            <Building2 />
          </span>
          <CardTitle>Create your workplace</CardTitle>
          <CardDescription>
            Use Clerk’s organization setup to choose the workplace name and logo.
            You will become its first manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button
            className="w-full"
            onClick={() =>
              openCreateOrganization({
                afterCreateOrganizationUrl: afterOrganizationCreated,
                skipInvitationScreen: true,
              })
            }
          >
            <Building2 /> Create workplace with Clerk
          </Button>
          <div className="border-t pt-5">
            <p className="mb-3 text-sm text-muted-foreground">
              Joining as an employee? Use the workplace link, ID, or code your
              manager shared with you.
            </p>
            <Link
              href="/join#join-workplace"
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              <KeyRound /> Join an existing workplace
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  const name = organization?.name.trim() ?? ""
  const slug = slugify(organization?.slug || name)

  return (
    <Card className="mx-auto max-w-xl shadow-none">
      <CardHeader>
        <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary">
          <Building2 />
        </span>
        <CardTitle>Finish setting up your operations hub</CardTitle>
        <CardDescription>
          Clerk now owns the workplace name, logo, managers, and members. The
          operations hub will use the active Organization shown below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 border bg-muted/30 p-4">
          <OrganizationSwitcher
            hidePersonal={false}
            afterCreateOrganizationUrl={afterOrganizationCreated}
            afterSelectOrganizationUrl="/manager"
            afterSelectPersonalUrl="/manager"
          />
          <span className="text-xs text-muted-foreground">Active workplace</span>
        </div>
        <div className="border p-4 text-sm">
          <p className="font-medium">Employee address</p>
          <p className="mt-1 text-muted-foreground">
            Assigned automatically from the Organization name:
          </p>
          <p className="mt-2 font-mono text-xs">?hub={slug || "workplace"}</p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          className="w-full"
          disabled={!isLoaded || !name || !slug || pending}
          onClick={async () => {
            setPending(true)
            setError("")
            try {
              await createHub(name, slug, "public")
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Could not create the operations hub"
              )
            } finally {
              setPending(false)
            }
          }}
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <Building2 />
          )}
          {pending ? "Creating operations hub…" : "Create operations hub"}
        </Button>
      </CardContent>
    </Card>
  )
}
