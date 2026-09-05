import type { AppMessageKey } from "@/i18n/messages"

export type EventCategoryColor =
  "blue" | "teal" | "violet" | "amber" | "rose" | "green"

export type ResolvedEventCategoryColor = EventCategoryColor | "slate"

export const eventCategoryColorOptions = [
  { value: "blue", label: "colorBlue" },
  { value: "teal", label: "colorTeal" },
  { value: "violet", label: "colorViolet" },
  { value: "amber", label: "colorAmber" },
  { value: "rose", label: "colorRose" },
  { value: "green", label: "colorGreen" },
] satisfies Array<{ value: EventCategoryColor; label: AppMessageKey }>

export const eventCategoryColorStyles = {
  blue: {
    dot: "bg-blue-500",
    soft: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    rail: "border-l-blue-400 dark:border-l-blue-500",
    header: "border-t-blue-400 dark:border-t-blue-500",
    hover: "hover:bg-blue-50/70 dark:hover:bg-blue-950/30",
  },
  teal: {
    dot: "bg-teal-500",
    soft: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
    rail: "border-l-teal-400 dark:border-l-teal-500",
    header: "border-t-teal-400 dark:border-t-teal-500",
    hover: "hover:bg-teal-50/70 dark:hover:bg-teal-950/30",
  },
  violet: {
    dot: "bg-violet-500",
    soft: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    rail: "border-l-violet-400 dark:border-l-violet-500",
    header: "border-t-violet-400 dark:border-t-violet-500",
    hover: "hover:bg-violet-50/70 dark:hover:bg-violet-950/30",
  },
  amber: {
    dot: "bg-amber-500",
    soft: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    rail: "border-l-amber-400 dark:border-l-amber-500",
    header: "border-t-amber-400 dark:border-t-amber-500",
    hover: "hover:bg-amber-50/70 dark:hover:bg-amber-950/30",
  },
  rose: {
    dot: "bg-rose-500",
    soft: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    rail: "border-l-rose-400 dark:border-l-rose-500",
    header: "border-t-rose-400 dark:border-t-rose-500",
    hover: "hover:bg-rose-50/70 dark:hover:bg-rose-950/30",
  },
  green: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    rail: "border-l-emerald-400 dark:border-l-emerald-500",
    header: "border-t-emerald-400 dark:border-t-emerald-500",
    hover: "hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30",
  },
  slate: {
    dot: "bg-slate-500",
    soft: "bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-300",
    rail: "border-l-slate-400 dark:border-l-slate-500",
    header: "border-t-slate-400 dark:border-t-slate-500",
    hover: "hover:bg-slate-100/70 dark:hover:bg-slate-900/40",
  },
} satisfies Record<
  ResolvedEventCategoryColor,
  { dot: string; soft: string; rail: string; header: string; hover: string }
>

type EventTypeWithColor = {
  id: string
  color?: EventCategoryColor
}

export function eventCategoryColor(
  categoryId: string,
  eventTypes: readonly EventTypeWithColor[]
): ResolvedEventCategoryColor {
  if (categoryId === "deputy-schedules") return "slate"
  const index = eventTypes.findIndex((eventType) => eventType.id === categoryId)
  const stored = index >= 0 ? eventTypes[index]?.color : undefined
  if (stored) return stored
  const fallbackIndex = index >= 0 ? index : 0
  return eventCategoryColorOptions[
    fallbackIndex % eventCategoryColorOptions.length
  ].value
}
