"use client"

import { T } from "@/components/providers/i18n-provider"

import { FileText } from "lucide-react"

import { Button } from "@/components/ui/button"

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <FileText /> <T>Print this guide</T>
    </Button>
  )
}
