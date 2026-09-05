"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const Toaster = ({ position, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const [responsivePosition, setResponsivePosition] =
    useState<ToasterProps["position"]>("bottom-center")

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 640px)")
    const updatePosition = () =>
      setResponsivePosition(desktop.matches ? "top-center" : "bottom-center")

    updatePosition()
    desktop.addEventListener("change", updatePosition)
    return () => desktop.removeEventListener("change", updatePosition)
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position ?? responsivePosition}
      className="toaster group sm:has-[.unsaved-changes-toast]:[--width:36rem]!"
      expand
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
        close: <XIcon className="size-3" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "grid w-(--width) grid-cols-[auto_minmax(0,1fr)_auto_auto] items-start gap-x-3 gap-y-4 bg-popover p-4 font-sans text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:[&.unsaved-changes-toast_[data-content]]:contents",
          content:
            "col-start-2 col-end-5 row-start-1 flex min-w-0 flex-col gap-1",
          title: "font-heading text-sm leading-5 font-semibold",
          description: "text-sm leading-relaxed text-muted-foreground",
          icon: "col-start-1 row-start-1 mt-0.5 flex size-4 shrink-0 items-center justify-center text-foreground [&>svg]:size-4",
          actionButton: cn(
            buttonVariants({ variant: "destructive", size: "sm" }),
            "col-start-4 row-start-2 !transition-all"
          ),
          cancelButton: cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "col-start-3 row-start-2 !transition-all"
          ),
          closeButton: cn(
            buttonVariants({ variant: "outline", size: "icon-xs" }),
            "absolute -top-2 -left-2 z-10 !transition-all"
          ),
          success: "[&_[data-icon]]:text-primary",
          info: "[&_[data-icon]]:text-primary",
          warning: "[&_[data-icon]]:text-foreground",
          error: "[&_[data-icon]]:text-destructive",
          loading: "[&_[data-icon]]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
