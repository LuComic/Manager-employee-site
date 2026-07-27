import {
  BookOpen,
  CreditCard,
  FileText,
  GraduationCap,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UsersRound,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { createElement } from "react"

import type { AppMessageKey } from "@/i18n/messages"

export const categoryIconOptions = [
  { key: "register", label: "register", icon: ReceiptText },
  { key: "orders", label: "orders", icon: ShoppingBag },
  { key: "payments", label: "payments", icon: CreditCard },
  { key: "documents", label: "documents", icon: FileText },
  { key: "people", label: "people", icon: UsersRound },
  { key: "safety", label: "safety", icon: ShieldCheck },
  { key: "food-service", label: "foodService", icon: UtensilsCrossed },
  { key: "inventory", label: "inventory", icon: PackageCheck },
  { key: "cleaning", label: "cleaning", icon: Sparkles },
  { key: "training", label: "training", icon: GraduationCap },
  { key: "maintenance", label: "maintenance", icon: Wrench },
  { key: "general", label: "general", icon: BookOpen },
] as const satisfies readonly {
  key: string
  label: AppMessageKey
  icon: LucideIcon
}[]

export type CategoryIconKey = (typeof categoryIconOptions)[number]["key"]

const categoryIconMap = Object.fromEntries(
  categoryIconOptions.map((option) => [option.key, option.icon])
) as Record<CategoryIconKey, LucideIcon>

export function getCategoryIcon(key: CategoryIconKey): LucideIcon {
  return categoryIconMap[key] ?? BookOpen
}

export function CategoryIcon({
  iconKey,
  className,
}: {
  iconKey: CategoryIconKey
  className?: string
}) {
  return createElement(getCategoryIcon(iconKey), { className })
}
