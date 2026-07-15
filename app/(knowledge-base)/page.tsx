import Link from "next/link"
import { ArrowRight, BookOpenCheck, CircleHelp, Headphones } from "lucide-react"

import { CategoryCard } from "@/components/knowledge-base/category-card"
import { ContactButton } from "@/components/knowledge-base/contact-dialog"
import { GuideCard } from "@/components/knowledge-base/guide-card"
import { SectionHeading } from "@/components/knowledge-base/section-heading"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { categories, guides } from "@/lib/knowledge-base"
import { cn } from "@/lib/utils"

export default function HomePage() {
  const featuredGuides = guides.filter((guide) => guide.featured)

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-h-64 flex-col justify-between bg-primary p-8 text-primary-foreground lg:col-span-2">
          <span className="flex size-12 items-center justify-center bg-primary-foreground/10">
            <BookOpenCheck className="size-6" />
          </span>
          <div className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">How can we help?</h1>
            <p className="mt-4 max-w-xl text-base text-primary-foreground/80">
              Find a clear answer or follow a short guide for the task in front of you.
            </p>
          </div>
        </div>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base normal-case tracking-normal">Need something quickly?</CardTitle>
            <CardDescription>These guides solve some of the most common questions at the counter.</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto flex-col items-stretch gap-2">
            {featuredGuides.slice(0, 3).map((guide) => (
              <Link
                key={guide.id}
                href={`/guides/${guide.id}`}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "w-full justify-between normal-case tracking-normal",
                )}
              >
                {guide.title} <ArrowRight />
              </Link>
            ))}
          </CardFooter>
        </Card>
      </section>

      <section>
        <SectionHeading
          title="Popular guides"
          description="Straightforward instructions for the tasks that come up most often."
          action={{ label: "View cash register", href: "/categories/register" }}
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featuredGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="Browse by work area" description="Choose the part of the shift you need help with." />
        <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base normal-case tracking-normal">
              <CircleHelp className="size-4 text-primary" /> Common questions
            </CardTitle>
            <CardDescription>Read quick answers to the questions that come up during a shift.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/questions" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Read the answers <ArrowRight />
            </Link>
          </CardFooter>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base normal-case tracking-normal">
              <Headphones className="size-4 text-primary" /> Need a person?
            </CardTitle>
            <CardDescription>Send a short question to the shift lead when a guide is not enough.</CardDescription>
          </CardHeader>
          <CardFooter>
            <ContactButton className="border border-border px-4" />
          </CardFooter>
        </Card>
      </section>
    </div>
  )
}
