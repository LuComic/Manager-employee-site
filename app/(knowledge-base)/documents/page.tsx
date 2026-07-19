import {
  BookText,
  ClipboardCheck,
  ContactRound,
  ShieldCheck,
  Table2,
  Truck,
} from "lucide-react"

import { PageHeading } from "@/components/operations/page-heading"
import { Badge } from "@/components/ui/badge"

const documents = [
  {
    title: "Team handbook",
    description: "Workplace policies, shared practices, and team standards.",
    type: "Text",
    icon: BookText,
  },
  {
    title: "Opening checklist",
    description: "The essential checks to complete before service begins.",
    type: "Checklist",
    icon: ClipboardCheck,
  },
  {
    title: "Weekly cleaning rota",
    description: "Areas, assigned teams, and the weekly cleaning schedule.",
    type: "Table",
    icon: Table2,
  },
  {
    title: "Safety information",
    description: "Emergency procedures and important safety contacts.",
    type: "Text",
    icon: ShieldCheck,
  },
  {
    title: "Supplier contacts",
    description: "A shared directory for regular suppliers and services.",
    type: "Directory",
    icon: ContactRound,
  },
  {
    title: "Delivery schedule",
    description: "Expected delivery days, times, and receiving notes.",
    type: "Table",
    icon: Truck,
  },
]

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Documents"
        description="Shared texts, checklists, tables, and reference information. These are sample documents for now."
      />

      <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 xl:grid-cols-3">
        {documents.map(({ title, description, type, icon: Icon }) => (
          <article
            key={title}
            className="flex min-h-32 items-start gap-4 bg-background p-6"
          >
            <span className="flex size-10 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {description}
              </p>
              <Badge variant="secondary" className="mt-4">
                {type}
              </Badge>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
