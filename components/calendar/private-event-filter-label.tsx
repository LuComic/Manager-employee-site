import { LockKeyhole } from "lucide-react"

import { T } from "@/components/translated-text"

export function PrivateEventFilterLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <LockKeyhole className="size-3" aria-hidden="true" />
      <T>private</T>
    </span>
  )
}
