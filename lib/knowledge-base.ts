import type { LucideIcon } from "lucide-react"

import type { CategoryIconKey } from "@/lib/category-icons"
import type { CategoryKind } from "@/lib/categories"
import type { EventCategoryColor } from "@/lib/event-category-colors"
import type { RichTextDocument } from "@/lib/rich-text"

export type CategoryId = string

export type Category = {
  id: CategoryId
  label: string
  iconKey: CategoryIconKey
  description: string
  kind: CategoryKind
  color?: EventCategoryColor
}

export type Guide = {
  id: string
  title: string
  description: string
  category: CategoryId
  icon: LucideIcon
  duration: string
  updated: string
  featured?: boolean
  published?: boolean
  keywords?: string[]
  relatedGuideIds?: string[]
  content: RichTextDocument
}
