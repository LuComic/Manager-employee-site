"use client"

import { useEffect, useId, useState } from "react"
import { ChevronDown, ListFilter } from "lucide-react"

import { T } from "@/components/translated-text"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ManagerFilterPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const contentId = useId()

  useEffect(() => {
    if (!window.matchMedia("(min-width: 640px)").matches) return
    const timeout = window.setTimeout(() => setOpen(true), 0)
    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <section className="border bg-background">
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between px-4 py-3 tracking-normal normal-case"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2">
          <ListFilter /> <T>filters</T>
        </span>
        <ChevronDown
          className={cn("transition-transform", open && "rotate-180")}
        />
      </Button>
      <div
        id={contentId}
        hidden={!open}
        className={cn("gap-4 border-t p-4", className)}
      >
        {children}
      </div>
    </section>
  )
}
