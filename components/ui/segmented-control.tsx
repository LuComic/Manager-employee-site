"use client"

import * as React from "react"

import { useAppTranslations } from "@/i18n/use-app-translations"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function SegmentedControl({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const t = useAppTranslations()
  const ariaLabel = props["aria-label"]

  return (
    <div
      data-slot="segmented-control"
      role="group"
      className={cn(
        "inline-flex max-w-full overflow-x-auto border bg-background",
        className
      )}
      {...props}
      aria-label={typeof ariaLabel === "string" ? t(ariaLabel) : ariaLabel}
    />
  )
}

function SegmentedControlItem({
  className,
  selected,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "variant"> & {
  selected: boolean
}) {
  return (
    <Button
      variant={selected ? "selected" : "ghost"}
      className={cn(
        "border-0 not-last:border-r not-last:border-border",
        className
      )}
      {...props}
      aria-pressed={selected}
    />
  )
}

export { SegmentedControl, SegmentedControlItem }
