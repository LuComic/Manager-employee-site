import { BookText, ClipboardCheck, Table2 } from "lucide-react"

import { PageHeading } from "@/components/operations/page-heading"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const cleaningRows = [
  ["Monday", "Bar shelves", "Closing team"],
  ["Wednesday", "Cold storage", "Kitchen lead"],
  ["Friday", "Terrace furniture", "Opening team"],
]

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Documents"
        description="A preview of the shared texts, checklists, and tables that will live here. Document creation and editing will be added later."
        action={<Badge variant="secondary">Preview content</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
              <BookText className="size-5" />
            </span>
            <CardTitle className="mt-4 text-base">Team handbook</CardTitle>
            <CardDescription>
              A sample long-form document for workplace policies and shared
              practices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Start every shift by checking Today for schedule changes and
              current announcements. If a process is unclear, ask the shift lead
              before continuing.
            </p>
            <p>
              Keep guest and team information private, report safety concerns
              immediately, and leave clear notes for the next shift.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
              <ClipboardCheck className="size-5" />
            </span>
            <CardTitle className="mt-4 text-base">Opening checklist</CardTitle>
            <CardDescription>
              A sample checklist that could later become an editable document.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                "Check entrances and emergency exits",
                "Review reservations and special requests",
                "Confirm tills and card terminals are ready",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center border text-xs text-primary">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardHeader>
          <span className="flex size-10 items-center justify-center bg-primary/10 text-primary">
            <Table2 className="size-5" />
          </span>
          <CardTitle className="mt-4 text-base">Weekly cleaning rota</CardTitle>
          <CardDescription>
            A sample table showing the kind of structured information this area
            can hold.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-lg border-collapse text-left text-sm">
            <caption className="sr-only">Weekly cleaning rota sample</caption>
            <thead>
              <tr className="border-b">
                <th className="py-3 pr-6 font-medium">Day</th>
                <th className="py-3 pr-6 font-medium">Area</th>
                <th className="py-3 font-medium">Responsible</th>
              </tr>
            </thead>
            <tbody>
              {cleaningRows.map(([day, area, responsible]) => (
                <tr key={day} className="border-b last:border-0">
                  <td className="py-3 pr-6">{day}</td>
                  <td className="py-3 pr-6 text-muted-foreground">{area}</td>
                  <td className="py-3 text-muted-foreground">{responsible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
