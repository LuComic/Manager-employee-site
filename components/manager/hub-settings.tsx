"use client"

import { T } from "@/components/translated-text"

import { useEffect, useRef, useState } from "react"
import { Building2, ImageIcon, Trash2, Upload } from "lucide-react"

import { ManagerHeading } from "@/components/manager/manager-heading"
import { CategorySchemaRecovery } from "@/components/manager/category-schema-recovery"
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
import type { AppMessageKey } from "@/i18n/messages"
import { useAppTranslations } from "@/i18n/use-app-translations"
import { BANNER_IMAGE_ACCEPT } from "@/lib/banner-image"
import { getCustomContactName } from "@/lib/contact"

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
    contactName: getCustomContactName(hub?.contactName) ?? "",
    contactEmail: hub?.contactEmail ?? "",
    contactPhone: hub?.contactPhone ?? "",
  }
}

type BannerChange =
  | { kind: "replace"; file: File; previewUrl: string }
  | { kind: "remove" }
  | null

export function HubSettingsManager() {
  const t = useAppTranslations()
  const {
    hub,
    saveHubSettings,
    uploadHubBanner,
    removeHubBanner,
    showFeedback,
  } = useOperations()
  const [settings, setSettings] = useState<HubSettings>(() =>
    settingsFromHub(hub)
  )
  const [settingsDirty, setSettingsDirty] = useState(false)
  const [bannerChange, setBannerChange] = useState<BannerChange>(null)
  const [pending, setPending] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const bannerPreviewUrlRef = useRef<string | undefined>(undefined)
  const dirty = settingsDirty || bannerChange !== null
  const bannerPreviewUrl =
    bannerChange?.kind === "replace"
      ? bannerChange.previewUrl
      : bannerChange?.kind === "remove"
        ? undefined
        : hub?.bannerImageUrl

  useEffect(
    () => () => {
      if (bannerPreviewUrlRef.current) {
        URL.revokeObjectURL(bannerPreviewUrlRef.current)
      }
    },
    []
  )

  function clearBannerPreview() {
    if (!bannerPreviewUrlRef.current) return
    URL.revokeObjectURL(bannerPreviewUrlRef.current)
    bannerPreviewUrlRef.current = undefined
  }

  function update(field: keyof HubSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }))
    setSettingsDirty(true)
  }

  return (
    <div className="space-y-6">
      <ManagerHeading
        title="establishmentSettings"
        description="updateWorkplaceDetailsEmployeesSeeAcrossHub"
      />

      <CategorySchemaRecovery />

      <form
        className="space-y-6"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!dirty) return
          setPending(true)
          try {
            if (settingsDirty) {
              await saveHubSettings(settings)
              setSettingsDirty(false)
            }
            if (bannerChange?.kind === "replace") {
              await uploadHubBanner(bannerChange.file)
            } else if (bannerChange?.kind === "remove") {
              await removeHubBanner()
            }
            if (bannerChange) {
              clearBannerPreview()
              setBannerChange(null)
            }
            showFeedback("establishmentSettingsSaved")
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
            <CardTitle className="mt-4 text-base">
              <T>workplaceDetails</T>
            </CardTitle>
            <CardDescription>
              <T>nameDescriptionAddressAppearEmployeeHomePage</T>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="establishmentName" htmlFor="hub-name">
              <Input
                id="hub-name"
                value={settings.name}
                onChange={(event) => update("name", event.target.value)}
                className="border border-input px-3"
                required
                maxLength={80}
              />
            </Field>
            <Field label="timeZone" htmlFor="hub-time-zone">
              <Input
                id="hub-time-zone"
                value={settings.timeZone}
                onChange={(event) => update("timeZone", event.target.value)}
                className="border border-input px-3"
                placeholder={t("tallinnTimeZone")}
                required
              />
              <p className="text-xs text-muted-foreground">
                <T>useianaTimeZoneSuchEuropeTallinnMessage</T>
              </p>
            </Field>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hub-description">
                <T>shortDescription</T>
              </Label>
              <Textarea
                id="hub-description"
                value={settings.description}
                onChange={(event) => update("description", event.target.value)}
                className="min-h-24 border border-input px-3"
                maxLength={500}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hub-address">
                <T>address</T>
              </Label>
              <Textarea
                id="hub-address"
                value={settings.address}
                onChange={(event) => update("address", event.target.value)}
                className="min-h-20 border border-input px-3"
                placeholder={t("streetCityPostalCode")}
                maxLength={500}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
              <ImageIcon className="size-5" />
            </span>
            <CardTitle className="mt-4 text-base">
              <T>todayPageBanner</T>
            </CardTitle>
            <CardDescription>
              <T>addWorkplacePhotoBehindEstablishmentNameDescriptionMessage</T>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="flex min-h-48 items-end border bg-primary bg-cover bg-center p-5 text-primary-foreground"
              style={
                bannerPreviewUrl
                  ? { backgroundImage: `url("${bannerPreviewUrl}")` }
                  : undefined
              }
            >
              <div className="bg-black/55 p-3">
                <p className="text-xs text-white/75">
                  <T>bannerPreview</T>
                </p>
                <p className="mt-1 font-semibold text-white">
                  <T>todayAt</T> {settings.name || t("yourWorkplaceLowercase")}
                </p>
              </div>
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept={BANNER_IMAGE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.currentTarget.value = ""
                if (!file) return
                clearBannerPreview()
                const previewUrl = URL.createObjectURL(file)
                bannerPreviewUrlRef.current = previewUrl
                setBannerChange({ kind: "replace", file, previewUrl })
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => bannerInputRef.current?.click()}
              >
                <Upload />
                <T>{bannerPreviewUrl ? "replaceImage" : "uploadImage"}</T>
              </Button>
              {bannerPreviewUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    clearBannerPreview()
                    setBannerChange(
                      hub?.bannerImageUrl ? { kind: "remove" } : null
                    )
                  }}
                >
                  <Trash2 /> <T>removeImage</T>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              <T>imageFormatAndSizeHelp</T>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              <T>employeeContact</T>
            </CardTitle>
            <CardDescription>
              <T>personRoleUsedHelpButtonEmailPhoneMessage</T>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Field label="nameOrRole" htmlFor="contact-name">
              <Input
                id="contact-name"
                value={settings.contactName}
                onChange={(event) => update("contactName", event.target.value)}
                className="border border-input px-3"
                placeholder={t("shiftLead")}
                maxLength={100}
              />
            </Field>
            <Field label="email" htmlFor="contact-email">
              <Input
                id="contact-email"
                type="email"
                value={settings.contactEmail}
                onChange={(event) => update("contactEmail", event.target.value)}
                className="border border-input px-3"
                placeholder={t("workhalEmailExample")}
                maxLength={200}
              />
            </Field>
            <Field label="phone" htmlFor="contact-phone">
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
            <T>{dirty ? "unsavedChanges" : "noUnsavedChanges"}</T>
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setSettings(settingsFromHub(hub))
                setSettingsDirty(false)
                clearBannerPreview()
                setBannerChange(null)
              }}
            >
              <T>cancel</T>
            </Button>
            <Button
              type="submit"
              disabled={pending || !dirty || !settings.name.trim()}
            >
              <T>{pending ? "saving" : "saveSettings"}</T>
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
  label: AppMessageKey
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        <T>{label}</T>
      </Label>
      {children}
    </div>
  )
}
