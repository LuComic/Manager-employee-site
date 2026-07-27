"use client"

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border border-transparent text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:border-primary/80 hover:bg-primary/80",
        outline:
          "border-border bg-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-input/30",
        secondary:
          "border-secondary bg-secondary text-secondary-foreground hover:border-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:border-secondary aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        selected:
          "border-control-selected-border bg-control-selected text-control-selected-foreground hover:border-control-selected-border hover:bg-control-selected-hover aria-expanded:border-control-selected-border aria-expanded:bg-control-selected aria-expanded:text-control-selected-foreground",
        ghost:
          "hover:border-muted hover:bg-muted hover:text-foreground aria-expanded:border-muted aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:border-muted/50 dark:hover:bg-muted/50",
        destructive:
          "border-destructive/10 bg-destructive/10 text-destructive hover:border-destructive/20 hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:border-destructive/20 dark:bg-destructive/20 dark:hover:border-destructive/30 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        xs: "h-7 gap-1 px-3 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        lg: "h-11 gap-1.5 px-8 has-data-[icon=inline-end]:pr-7 has-data-[icon=inline-start]:pl-7",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {markInlineIcons(children)}
    </ButtonPrimitive>
  )
}

function markInlineIcons(children: ReactNode) {
  const items = Children.toArray(children)
  if (items.length < 2) return children

  return items.map((child, index) => {
    if (!isIconElement(child)) return child

    const position =
      index === 0
        ? "inline-start"
        : index === items.length - 1
          ? "inline-end"
          : undefined

    if (!position) return child
    return cloneElement(
      child as ReactElement<{ "data-icon"?: "inline-start" | "inline-end" }>,
      { "data-icon": position }
    )
  })
}

function isIconElement(child: ReactNode) {
  if (!isValidElement(child)) return false
  return typeof child.type !== "string" || child.type === "svg"
}

export { Button, buttonVariants }
