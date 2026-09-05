import { T } from "@/components/translated-text"
import type { AppMessageKey } from "@/i18n/messages"
import { AreaIconTile } from "@/components/operations/area-icon-tile"
import type { AreaKey } from "@/lib/area-styles"

type PageHeadingProps = {
  action?: React.ReactNode
  area?: AreaKey
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
      <div className="flex max-w-2xl items-start gap-3">
        {props.area && <AreaIconTile area={props.area} />}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {props.action}
    </div>
  )
}
