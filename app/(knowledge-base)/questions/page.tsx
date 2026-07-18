"use client"

import { Headphones } from "lucide-react"

import { ContactButton } from "@/components/knowledge-base/contact-dialog"
import { EmptyState } from "@/components/operations/empty-state"
import { useOperations } from "@/components/providers/operations-provider"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function QuestionsPage() {
  const { faqs } = useOperations()
  const publishedFaqs = faqs.filter((faq) => faq.published)

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Common questions
      </h1>
      <p className="mt-4 text-muted-foreground">
        Quick answers for the moments when you are not quite sure what to do.
      </p>

      {publishedFaqs.length ? (
        <Card className="mt-8 shadow-none">
          <CardContent>
            <Accordion>
              {publishedFaqs.map((item) => (
                <AccordionItem
                  id={item.id}
                  key={item.id}
                  value={item.id}
                  className="scroll-mt-24"
                >
                  <AccordionTrigger className="text-base underline-offset-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={Headphones}
            title="No common questions yet"
            description="Published answers will appear here. You can still ask for help below."
          />
        </div>
      )}

      <Card className="mt-6 bg-primary/5 shadow-none ring-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-normal normal-case">
            <Headphones className="size-4 text-primary" /> Still unsure?
          </CardTitle>
          <CardDescription>
            It is always fine to ask for help when you are unsure.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <ContactButton className="border border-border px-4" />
        </CardFooter>
      </Card>
    </div>
  )
}
