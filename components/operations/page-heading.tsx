import { T } from "@/components/translated-text"
import type { AppMessageKey } from "@/i18n/messages"

type PageHeadingProps = {
  action?: React.ReactNode
} & (
  | { title: AppMessageKey; titleText?: never }
  | { title?: never; titleText: React.ReactNode }
) &
  (
    | { description: AppMessageKey; descriptionText?: never }
    | { description?: never; descriptionText: React.ReactNode }
  )

export function PageHeading(props: PageHeadingProps) {
  const title = props.title ? <T>{props.title}</T> : props.titleText
  const description = props.description ? (
    <T>{props.description}</T>
  ) : (
    props.descriptionText
  )

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {props.action}
    </div>
  )
}
