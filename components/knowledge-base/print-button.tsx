"use client"

import { FileText } from "lucide-react"

import { Button } from "@/components/ui/button"

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <FileText /> Print this guide
    </Button>
  )
}
