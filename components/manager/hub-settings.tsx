"use client"

import { useState } from "react"
import { Building2 } from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import {
  type HubSettings,
  useOperations,
} from "@/components/providers/operations-provider"
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
import { Textarea } from "@/components/ui/textarea"

function settingsFromHub(
  hub: ReturnType<typeof useOperations>["hub"]
): HubSettings {
  return {
    name: hub?.name ?? "",
    description: hub?.description ?? "",
    address: hub?.address ?? "",
    timeZone:
      hub?.timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC",
    contactName: hub?.contactName ?? "shift lead",
    contactEmail: hub?.contactEmail ?? "",
    contactPhone: hub?.contactPhone ?? "",
  }
}

export function HubSettingsManager() {
  const { hub, saveHubSettings, showFeedback } = useOperations()
  const [settings, setSettings] = useState<HubSettings>(() =>
    settingsFromHub(hub)
  )
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)

  function update(field: keyof HubSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }))
    setDirty(true)
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="Establishment settings"
        description="Update the workplace details employees see across the hub."
      />

      <form
        className="space-y-6"
        onSubmit={async (event) => {
          event.preventDefault()
          setPending(true)
          try {
            await saveHubSettings(settings)
            setDirty(false)
            showFeedback("Establishment settings saved.")
          } finally {
            setPending(false)
          }
        }}
      >
        <Card className="shadow-none">
          <CardHeader>
            <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </span>
            <CardTitle className="mt-4 text-base">Workplace details</CardTitle>
            <CardDescription>
              The name, description, and address appear on the employee home
              page.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Establishment name" htmlFor="hub-name">
              <Input
                id="hub-name"
                value={settings.name}
                onChange={(event) => update("name", event.target.value)}
                className="border border-input px-3"
                required
                maxLength={80}
              />
            </Field>
            <Field label="Time zone" htmlFor="hub-time-zone">
              <Input
                id="hub-time-zone"
                value={settings.timeZone}
                onChange={(event) => update("timeZone", event.target.value)}
                className="border border-input px-3"
                placeholder="Europe/Tallinn"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use an IANA time zone such as Europe/Tallinn or
                America/New_York.
              </p>
            </Field>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hub-description">Short description</Label>
              <Textarea
                id="hub-description"
                value={settings.description}
                onChange={(event) => update("description", event.target.value)}
                className="min-h-24 border border-input px-3"
                maxLength={500}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hub-address">Address</Label>
              <Textarea
                id="hub-address"
                value={settings.address}
                onChange={(event) => update("address", event.target.value)}
                className="min-h-20 border border-input px-3"
                placeholder="Street, city, postal code"
                maxLength={500}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Employee contact</CardTitle>
            <CardDescription>
              This person or role is used by the help button. Email and phone
              are optional direct contact methods.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="Name or role" htmlFor="contact-name">
              <Input
                id="contact-name"
                value={settings.contactName}
                onChange={(event) => update("contactName", event.target.value)}
                className="border border-input px-3"
                placeholder="Shift lead"
                maxLength={100}
              />
            </Field>
            <Field label="Email" htmlFor="contact-email">
              <Input
                id="contact-email"
                type="email"
                value={settings.contactEmail}
                onChange={(event) => update("contactEmail", event.target.value)}
                className="border border-input px-3"
                placeholder="operations@example.com"
                maxLength={200}
              />
            </Field>
            <Field label="Phone" htmlFor="contact-phone">
              <Input
                id="contact-phone"
                type="tel"
                value={settings.contactPhone}
                onChange={(event) => update("contactPhone", event.target.value)}
                className="border border-input px-3"
                placeholder="+372 5555 5555"
                maxLength={80}
              />
            </Field>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-col gap-3 border bg-background/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {dirty ? "Unsaved changes" : "No unsaved changes"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setSettings(settingsFromHub(hub))
                setDirty(false)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !settings.name.trim()}>
              {pending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
