"use client"

import NextLink from "next/link"

import { useI18n } from "@/components/providers/i18n-provider"

export function LocalizedLink({
  href: destination,
  ...props
}: React.ComponentProps<typeof NextLink>) {
  const { href } = useI18n()

  return (
    <NextLink
      href={typeof destination === "string" ? href(destination) : destination}
      {...props}
    />
  )
}
