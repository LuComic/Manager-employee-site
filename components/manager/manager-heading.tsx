export function ManagerHeading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
