import {
  BookOpen,
  CalendarDays,
  Files,
  Megaphone,
  Bell,
  CircleHelp,
  ArrowLeftRight,
  Building2,
  type LucideIcon,
} from "lucide-react"

export type AreaKey =
  | "guides"
  | "calendar"
  | "announcements"
  | "documents"
  | "questions"
  | "trades"
  | "notifications"
  | "workplace"

type AreaStyle = {
  icon: LucideIcon
  iconClass: string
  tile: string
  rail: string
  hover: string
}

export const areaStyles = {
  guides: {
    icon: BookOpen,
    iconClass: "text-violet-600 dark:text-violet-400",
    tile: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    rail: "border-l-violet-400 dark:border-l-violet-500",
    hover:
      "group-hover:bg-violet-50/70 group-active:bg-violet-100/70 dark:group-hover:bg-violet-950/30 dark:group-active:bg-violet-950/50",
  },
  calendar: {
    icon: CalendarDays,
    iconClass: "text-blue-600 dark:text-blue-400",
    tile: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    rail: "border-l-blue-400 dark:border-l-blue-500",
    hover:
      "group-hover:bg-blue-50/70 group-active:bg-blue-100/70 dark:group-hover:bg-blue-950/30 dark:group-active:bg-blue-950/50",
  },
  announcements: {
    icon: Megaphone,
    iconClass: "text-amber-600 dark:text-amber-400",
    tile: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    rail: "border-l-amber-400 dark:border-l-amber-500",
    hover:
      "group-hover:bg-amber-50/70 group-active:bg-amber-100/70 dark:group-hover:bg-amber-950/30 dark:group-active:bg-amber-950/50",
  },
  documents: {
    icon: Files,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    tile: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    rail: "border-l-emerald-400 dark:border-l-emerald-500",
    hover:
      "group-hover:bg-emerald-50/70 group-active:bg-emerald-100/70 dark:group-hover:bg-emerald-950/30 dark:group-active:bg-emerald-950/50",
  },
  questions: {
    icon: CircleHelp,
    iconClass: "text-cyan-600 dark:text-cyan-400",
    tile: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
    rail: "border-l-cyan-400 dark:border-l-cyan-500",
    hover:
      "group-hover:bg-cyan-50/70 group-active:bg-cyan-100/70 dark:group-hover:bg-cyan-950/30 dark:group-active:bg-cyan-950/50",
  },
  trades: {
    icon: ArrowLeftRight,
    iconClass: "text-rose-600 dark:text-rose-400",
    tile: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    rail: "border-l-rose-400 dark:border-l-rose-500",
    hover:
      "group-hover:bg-rose-50/70 group-active:bg-rose-100/70 dark:group-hover:bg-rose-950/30 dark:group-active:bg-rose-950/50",
  },
  notifications: {
    icon: Bell,
    iconClass: "text-sky-600 dark:text-sky-400",
    tile: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    rail: "border-l-sky-400 dark:border-l-sky-500",
    hover:
      "group-hover:bg-sky-50/70 group-active:bg-sky-100/70 dark:group-hover:bg-sky-950/30 dark:group-active:bg-sky-950/50",
  },
  workplace: {
    icon: Building2,
    iconClass: "text-slate-600 dark:text-slate-400",
    tile: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    rail: "border-l-slate-400 dark:border-l-slate-500",
    hover:
      "group-hover:bg-slate-50 group-active:bg-slate-100 dark:group-hover:bg-slate-800/70 dark:group-active:bg-slate-800",
  },
} satisfies Record<AreaKey, AreaStyle>
