"use client"

import { T } from "@/components/translated-text"

import { FileText } from "lucide-react"

import { Button } from "@/components/ui/button"

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <FileText /> <T>printThisGuide</T>
    </Button>
  )
}
