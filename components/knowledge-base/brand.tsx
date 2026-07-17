import Link from "next/link"
import { BriefcaseBusiness } from "lucide-react"

export function Brand({
  compact = false,
  onNavigate,
  linked = true,
}: {
  compact?: boolean
  onNavigate?: () => void
  linked?: boolean
}) {
  const content = (
    <>
      <span className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
        <BriefcaseBusiness className="size-5" />
      </span>
      {!compact && (
        <span>
          <span className="block font-semibold tracking-tight">
            Operations hub
          </span>
          <span className="block text-xs text-muted-foreground">
            North & Pine Bistro
          </span>
        </span>
      )}
    </>
  )

  if (!linked) return <div className="flex items-center gap-3">{content}</div>

  return (
    <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
      {content}
    </Link>
  )
}
