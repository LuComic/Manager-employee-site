import Link from "next/link"
import { ArrowLeft, Clock3 } from "lucide-react"

import { PrintButton } from "@/components/knowledge-base/print-button"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getCategory, type Guide } from "@/lib/knowledge-base"
import { cn } from "@/lib/utils"

export function GuideDetail({ guide }: { guide: Guide }) {
  const category = getCategory(guide.category)
  const Icon = guide.icon

  return (
    <article className="mx-auto max-w-4xl">
      <Link
        href={`/categories/${guide.category}`}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 tracking-normal normal-case"
        )}
      >
        <ArrowLeft /> Back to {category?.label}
      </Link>

      <Card className="gap-0 py-0 shadow-none">
        <div className="border-b p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <span className="flex size-12 shrink-0 items-center justify-center bg-primary/10 text-primary">
              <Icon className="size-6" />
            </span>
            <div>
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" /> {guide.duration}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {guide.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-muted-foreground">
                {guide.description}
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Follow these steps</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Work through the steps in order and ask the shift lead if anything
            looks different.
          </p>

          <div className="mt-8">
            {guide.steps.map((step, index) => (
              <div
                key={step.title}
                className="flex gap-4 border-t py-6 first:border-t-0 first:pt-0"
              >
                <span className="flex size-10 items-center justify-center border bg-muted text-sm font-semibold">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.detail}
                  </p>
                  {step.tip && (
                    <div className="mt-4 border-l-2 border-primary bg-primary/5 p-4 text-sm">
                      <strong>Useful tip:</strong>{" "}
                      <span className="text-muted-foreground">{step.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>

        <div className="flex flex-col gap-4 border-t bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="text-xs text-muted-foreground">
            {guide.updated} · Approved by operations
          </span>
          <PrintButton />
        </div>
      </Card>
    </article>
  )
}
