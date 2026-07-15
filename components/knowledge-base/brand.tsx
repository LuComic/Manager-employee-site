import Link from "next/link"
import { BookOpenCheck } from "lucide-react"

export function Brand({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
      <span className="flex size-10 items-center justify-center bg-primary text-primary-foreground">
        <BookOpenCheck className="size-5" />
      </span>
      {!compact && (
        <span>
          <span className="block font-semibold tracking-tight">Service Manual</span>
          <span className="block text-xs text-muted-foreground">North & Pine Bistro</span>
        </span>
      )}
    </Link>
  )
}
