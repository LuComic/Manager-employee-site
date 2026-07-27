"use client"

import * as React from "react"

import { useI18n } from "@/components/providers/i18n-provider"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const { t } = useI18n()
  const translatedProps = {
    ...props,
    placeholder:
      typeof props.placeholder === "string"
        ? t(props.placeholder)
        : props.placeholder,
    "aria-label":
      typeof props["aria-label"] === "string"
        ? t(props["aria-label"])
        : props["aria-label"],
    title: typeof props.title === "string" ? t(props.title) : props.title,
  }

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-none border border-transparent border-b-input bg-transparent px-0 py-3 text-base transition-[color,border-color] outline-none placeholder:text-muted-foreground focus-visible:border-b-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-b-destructive md:text-sm dark:aria-invalid:border-b-destructive/50",
        className
      )}
      {...translatedProps}
    />
  )
}

export { Textarea }
