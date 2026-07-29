import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 rounded-lg bg-contain bg-center bg-no-repeat shadow-sm",
        className
      )}
      style={{ backgroundImage: 'url("/workhal-square.png")' }}
    />
  )
}
