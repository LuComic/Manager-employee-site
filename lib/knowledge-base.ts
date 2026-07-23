import {
  AlertCircle,
  BookOpen,
  ClipboardCheck,
  FileText,
  HandCoins,
  MessageCircleQuestion,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react"

import type { CategoryIconKey } from "@/lib/category-icons"
import type { GuideStep, RichTextDocument } from "@/lib/rich-text"

export type CategoryId = string

export type Category = {
  id: CategoryId
  label: string
  iconKey: CategoryIconKey
  description: string
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
  content: RichTextDocument
}

export type SeedGuide = Omit<Guide, "content"> & {
  steps: GuideStep[]
}

export const categories: Category[] = [
  {
    id: "register",
    label: "Cash register",
    iconKey: "register",
    description: "Open, run, and close the till.",
  },
  {
    id: "orders",
    label: "Orders",
    iconKey: "orders",
    description: "Take and manage every kind of order.",
  },
  {
    id: "payments",
    label: "Payments",
    iconKey: "payments",
    description: "Handle payments, refunds, and tips.",
  },
  {
    id: "invoices",
    label: "Invoices",
    iconKey: "documents",
    description: "Find receipts and send business invoices.",
  },
  {
    id: "service",
    label: "Guest service",
    iconKey: "people",
    description: "Create a welcoming guest experience.",
  },
  {
    id: "policies",
    label: "Safety & policies",
    iconKey: "safety",
    description: "Check the important house rules.",
  },
]

export const guides: SeedGuide[] = [
  {
    id: "open-register",
    title: "Open the cash register",
    description:
      "Count the float, sign in, and prepare the till for the first guest.",
    category: "register",
    icon: ReceiptText,
    duration: "5 min",
    updated: "Updated today",
    featured: true,
    steps: [
      {
        title: "Collect the till key",
        detail:
          "Ask the shift lead for the numbered key assigned to the register. Never borrow another team member’s login.",
      },
      {
        title: "Count the opening float",
        detail:
          "Count the notes and coins by denomination. The total should be €150.00.",
        tip: "Count once from largest to smallest, then once in reverse.",
      },
      {
        title: "Sign in and confirm the amount",
        detail:
          "Enter the staff code, choose Open shift, and type the float total.",
      },
      {
        title: "Run a quick check",
        detail:
          "Confirm the receipt paper, card terminal, and cash drawer work before serving a guest.",
      },
    ],
  },
  {
    id: "close-register",
    title: "Close the cash register",
    description:
      "Balance the drawer and finish the shift without missing a step.",
    category: "register",
    icon: ClipboardCheck,
    duration: "8 min",
    updated: "Updated 2 days ago",
    featured: true,
    steps: [
      {
        title: "Print the shift report",
        detail:
          "Open Reports, select Current shift, and print the summary before counting cash.",
      },
      {
        title: "Count the drawer",
        detail:
          "Count the cash away from guests using the count sheet beside the office safe.",
      },
      {
        title: "Record any difference",
        detail:
          "Enter the counted total and add a short note if the difference is over €2.00.",
      },
      {
        title: "Prepare the deposit",
        detail:
          "Return the €150 float and seal the remaining cash with the signed report.",
      },
    ],
  },
  {
    id: "split-payment",
    title: "Split a payment",
    description: "Divide a table bill by item, amount, or number of guests.",
    category: "payments",
    icon: HandCoins,
    duration: "4 min",
    updated: "Updated this week",
    featured: true,
    steps: [
      {
        title: "Open the table",
        detail: "Review the order with the guests before selecting Pay.",
      },
      {
        title: "Choose how to split",
        detail:
          "Select Split, then choose By item, Equal parts, or Custom amount.",
      },
      {
        title: "Take each payment",
        detail:
          "Complete one payment at a time. The remaining amount updates automatically.",
      },
      {
        title: "Offer receipts",
        detail:
          "Print or email individual receipts after the full balance reaches zero.",
      },
    ],
  },
  {
    id: "business-invoice",
    title: "Send a business invoice",
    description: "Create an accurate invoice and send it to a company contact.",
    category: "invoices",
    icon: FileText,
    duration: "6 min",
    updated: "Updated yesterday",
    featured: true,
    steps: [
      {
        title: "Collect the company details",
        detail:
          "Ask for the legal name, registration number, billing address, and email.",
      },
      {
        title: "Find the paid order",
        detail: "Open Orders, choose History, and select the correct receipt.",
      },
      {
        title: "Create the invoice",
        detail:
          "Choose Business invoice and carefully enter the details provided.",
      },
      {
        title: "Review and send",
        detail:
          "Confirm the total, date, and recipient email before selecting Send.",
      },
    ],
  },
  {
    id: "refund-payment",
    title: "Refund a payment",
    description: "Return a card or cash payment with the correct approval.",
    category: "payments",
    icon: RotateCcw,
    duration: "5 min",
    updated: "Updated 3 days ago",
    steps: [
      {
        title: "Confirm the reason",
        detail:
          "Ask what went wrong and check the order details with the guest.",
      },
      {
        title: "Request approval",
        detail:
          "A shift lead must approve refunds over €20 using their staff code.",
      },
      {
        title: "Return the payment",
        detail:
          "Open the original receipt, choose Refund, and select the correct items.",
      },
      {
        title: "Keep the record",
        detail: "Print the refund slip and add a brief, factual reason.",
      },
    ],
  },
  {
    id: "reprint-receipt",
    title: "Reprint a receipt",
    description: "Find a past sale and print or email a new copy.",
    category: "invoices",
    icon: BookOpen,
    duration: "2 min",
    updated: "Updated last week",
    steps: [
      {
        title: "Open order history",
        detail: "Choose Orders, then History from the main register screen.",
      },
      {
        title: "Find the purchase",
        detail:
          "Search by time, total, or the final four digits of the payment card.",
      },
      {
        title: "Send a copy",
        detail: "Choose Receipt, then select Print or Email.",
      },
    ],
  },
  {
    id: "void-item",
    title: "Void an item or order",
    description:
      "Correct an order before payment while keeping a clear record.",
    category: "orders",
    icon: AlertCircle,
    duration: "3 min",
    updated: "Updated 5 days ago",
    steps: [
      {
        title: "Select the item",
        detail: "Open the order and select the incorrect item once.",
      },
      {
        title: "Choose Void",
        detail:
          "Select the closest reason from the list. Avoid Other when a specific reason applies.",
      },
      {
        title: "Tell the kitchen",
        detail:
          "If the item was already sent, speak to the kitchen pass immediately.",
      },
    ],
  },
  {
    id: "takeaway-order",
    title: "Pack a takeaway order",
    description: "Check, pack, and hand over an order with confidence.",
    category: "orders",
    icon: PackageCheck,
    duration: "4 min",
    updated: "Updated this week",
    steps: [
      {
        title: "Match the ticket",
        detail:
          "Read the order number and every item before placing anything in the bag.",
      },
      {
        title: "Add the extras",
        detail: "Include the correct cutlery, napkins, sauces, and drinks.",
      },
      {
        title: "Seal and label",
        detail:
          "Close the bag, attach the ticket, and place it in the correct pickup area.",
      },
      {
        title: "Confirm at handover",
        detail:
          "Ask the guest or courier for the order number before handing it over.",
      },
    ],
  },
  {
    id: "allergy-request",
    title: "Handle an allergy request",
    description: "Take extra care when a guest tells you about an allergy.",
    category: "service",
    icon: UtensilsCrossed,
    duration: "4 min",
    updated: "Reviewed today",
    steps: [
      {
        title: "Listen and repeat",
        detail:
          "Repeat the allergy back to the guest so you both know it was understood correctly.",
      },
      {
        title: "Ask the kitchen",
        detail:
          "Never guess. Check the current allergen guide and confirm with the shift lead or chef.",
      },
      {
        title: "Mark the order",
        detail:
          "Use the red Allergy button and add a short note in plain language.",
      },
      {
        title: "Confirm at service",
        detail:
          "State the allergy when collecting and when placing the dish on the table.",
      },
    ],
  },
  {
    id: "guest-complaint",
    title: "Respond to a guest complaint",
    description:
      "Listen well, take action, and know when to involve a manager.",
    category: "service",
    icon: MessageCircleQuestion,
    duration: "5 min",
    updated: "Updated this month",
    steps: [
      {
        title: "Give full attention",
        detail:
          "Stop other tasks when safe, make eye contact, and let the guest finish.",
      },
      {
        title: "Acknowledge the problem",
        detail:
          "Thank them for speaking up and apologise for their experience without assigning blame.",
      },
      {
        title: "Offer the next step",
        detail:
          "Fix simple issues quickly. Ask the shift lead about safety, payment, or compensation concerns.",
      },
    ],
  },
  {
    id: "cash-safety",
    title: "Keep cash secure",
    description:
      "Follow the everyday rules that protect the team and the business.",
    category: "policies",
    icon: ShieldCheck,
    duration: "4 min",
    updated: "Reviewed this week",
    steps: [
      {
        title: "Keep the drawer closed",
        detail:
          "Only open the drawer for a cash transaction or an approved count.",
      },
      {
        title: "Call for large notes",
        detail:
          "Ask a shift lead to verify €100 and €200 notes before accepting them.",
      },
      {
        title: "Never share codes",
        detail: "Lock the register when stepping away, even for a moment.",
      },
    ],
  },
  {
    id: "end-cleaning",
    title: "Complete the closing clean",
    description: "Leave the front counter safe and ready for tomorrow.",
    category: "policies",
    icon: Sparkles,
    duration: "10 min",
    updated: "Updated last week",
    steps: [
      {
        title: "Clear and sort",
        detail:
          "Return stock, discard waste correctly, and move dirty items to the wash area.",
      },
      {
        title: "Clean touch points",
        detail:
          "Use the labelled food-safe spray on screens, counter edges, and handles.",
      },
      {
        title: "Restock essentials",
        detail:
          "Refill receipt rolls, takeaway bags, and napkins to the marked level.",
      },
      {
        title: "Sign the checklist",
        detail:
          "Initial each completed area and tell the shift lead about anything unfinished.",
      },
    ],
  },
]

for (const guide of guides) {
  guide.published = true
  guide.keywords = [guide.category, ...guide.title.toLowerCase().split(" ")]
}

export const commonQuestions = [
  {
    question: "I made a mistake on an order. What should I do?",
    answer:
      "If it has not been paid, open the item and choose Void. If payment is complete, ask the shift lead before refunding anything. Never create a second order to hide a mistake.",
  },
  {
    question: "What if the cash count is different?",
    answer:
      "Count it once more, slowly and by denomination. If it is still different, enter the real amount and call the shift lead. Do not add or remove personal money.",
  },
  {
    question: "Can I recommend a dish to a guest with an allergy?",
    answer:
      "Do not guess. Repeat the allergy, check the current allergen guide, and confirm with the kitchen or shift lead before making a recommendation.",
  },
  {
    question: "When should I contact the shift lead?",
    answer:
      "Contact the shift lead for safety concerns, harassment, injuries, payment disputes, refunds over the approval limit, or any situation where you feel unsure or unsafe.",
  },
]

export function getCategory(id: string) {
  return categories.find((category) => category.id === id)
}

export function getGuide(id: string) {
  return guides.find((guide) => guide.id === id)
}

export function getGuidesForCategory(category: CategoryId) {
  return guides.filter((guide) => guide.category === category)
}
