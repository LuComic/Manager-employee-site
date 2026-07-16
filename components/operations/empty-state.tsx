import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center border bg-background p-8 text-center">
      <span className="flex size-12 items-center justify-center bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
