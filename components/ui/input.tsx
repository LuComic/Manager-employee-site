"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { useI18n } from "@/components/providers/i18n-provider"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
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
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 border border-transparent border-b-input bg-transparent px-0 py-1 text-base transition-[color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-b-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-b-destructive md:text-sm dark:aria-invalid:border-b-destructive/50",
        className
      )}
      {...translatedProps}
    />
  )
}

export { Input }
