"use client"

import { T } from "@/components/translated-text"
import {
  useAppErrorTranslation,
  useAppTranslations,
  useLocalizedHref,
} from "@/i18n/use-app-translations"

import { useState } from "react"
import { Link } from "@/i18n/navigation"
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
  const href = useLocalizedHref()
  const t = useAppTranslations()
  const translateError = useAppErrorTranslation()
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
            <T>createYourWorkplace</T>
          </h1>
          <CardDescription>
            <T>chooseWorkplaceNameLogoBecomeFirstOwner</T>
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
            <Building2 /> <T>createWorkplace</T>
          </Button>
          <div className="border-t pt-5">
            <p className="mb-3 text-sm text-muted-foreground">
              <T>joiningEmployeeUseWorkplaceLinkidCodeMessage</T>
            </p>
            <Link
              href="/join#join-workplace"
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              <KeyRound data-icon="inline-start" />{" "}
              <T>joinAnExistingWorkplace</T>
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
          <T>finishSettingUpWorkplace</T>
        </h1>
        <CardDescription>
          <T>workplaceAccountUsesWorkhal</T>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col items-start gap-3 border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full min-w-0 overflow-hidden sm:w-auto sm:max-w-64">
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl={afterOrganizationCreated}
              afterSelectOrganizationUrl={href("/manager")}
              afterSelectPersonalUrl={href("/manager")}
            />
          </div>
          <span className="text-xs wrap-break-word text-muted-foreground">
            <T>activeWorkplace</T>
          </span>
        </div>
        <div className="border p-4 text-sm">
          <p className="font-medium">
            <T>employeeAddress</T>
          </p>
          <p className="mt-1 text-muted-foreground">
            <T>assignedAutomaticallyFromTheWorkplaceName</T>
          </p>
          <p className="mt-2 font-mono text-xs [overflow-wrap:anywhere]">
            <T>hubQueryParameter</T>
            {slug || "workplace"}
          </p>
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
              await createHub(name, slug)
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? translateError(caught)
                  : t("couldNotCreateWorkplace")
              )
            } finally {
              setPending(false)
            }
          }}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Building2 />}
          {t(pending ? "creatingWorkplace" : "createWorkplace")}
        </Button>
      </CardContent>
    </Card>
  )
}
