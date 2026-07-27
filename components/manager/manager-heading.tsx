import { T } from "@/components/translated-text"
import type { AppMessageKey } from "@/i18n/messages"

export function ManagerHeading({
  title,
  description,
  action,
}: {
  title: AppMessageKey
  description: AppMessageKey
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>{title}</T>
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          <T>{description}</T>
        </p>
      </div>
      {action}
    </div>
  )
}
