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

export const categoryIconOptions = [
  { key: "register", label: "Register", icon: ReceiptText },
  { key: "orders", label: "Orders", icon: ShoppingBag },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "people", label: "People", icon: UsersRound },
  { key: "safety", label: "Safety", icon: ShieldCheck },
  { key: "food-service", label: "Food service", icon: UtensilsCrossed },
  { key: "inventory", label: "Inventory", icon: PackageCheck },
  { key: "cleaning", label: "Cleaning", icon: Sparkles },
  { key: "training", label: "Training", icon: GraduationCap },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
  { key: "general", label: "General", icon: BookOpen },
] as const

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
