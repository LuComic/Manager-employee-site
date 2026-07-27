"use client"

import { T, useI18n } from "@/components/providers/i18n-provider"

import { useState } from "react"
import { LocalizedLink as Link } from "@/components/localized-link"
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
} from "@/components/ui/card"
import { slugify } from "@/lib/operations"

export function HubSetup() {
  const { href, t } = useI18n()
  const afterOrganizationCreated = href("/manager")
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
          <h1 className="font-heading text-lg font-semibold">
            <T>Create your workplace</T>
          </h1>
          <CardDescription>
            <T>
              Choose the workplace name and logo. You will become its first
              owner.
            </T>
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
            <Building2 /> <T>Create workplace</T>
          </Button>
          <div className="border-t pt-5">
            <p className="mb-3 text-sm text-muted-foreground">
              <T>
                Joining as an employee? Use the workplace link, ID, or code your
                manager shared with you.
              </T>
            </p>
            <Link
              href="/join#join-workplace"
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              <KeyRound /> <T>Join an existing workplace</T>
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
        <h1 className="font-heading text-lg font-semibold">
          <T>Finish setting up your operations hub</T>
        </h1>
        <CardDescription>
          <T>
            Your workplace account manages the name, logo, and members. The
            operations hub will use the active workplace shown below.
          </T>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 border bg-muted/30 p-4">
          <OrganizationSwitcher
            hidePersonal={false}
            afterCreateOrganizationUrl={afterOrganizationCreated}
            afterSelectOrganizationUrl={href("/manager")}
            afterSelectPersonalUrl={href("/manager")}
          />
          <span className="text-xs text-muted-foreground">
            <T>Active workplace</T>
          </span>
        </div>
        <div className="border p-4 text-sm">
          <p className="font-medium">
            <T>Employee address</T>
          </p>
          <p className="mt-1 text-muted-foreground">
            <T>Assigned automatically from the workplace name:</T>
          </p>
          <p className="mt-2 font-mono text-xs">
            <T>?hub=</T>
            {slug || "workplace"}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            <T>{error}</T>
          </p>
        )}
        <Button
          className="w-full"
          disabled={!isLoaded || !name || !slug || pending}
          onClick={async () => {
            setPending(true)
            setError("")
            try {
              await createHub(name, slug)
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? t(caught.message)
                  : t("Could not create the operations hub")
              )
            } finally {
              setPending(false)
            }
          }}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Building2 />}
          {t(pending ? "Creating operations hub…" : "Create operations hub")}
        </Button>
      </CardContent>
    </Card>
  )
}
