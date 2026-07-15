import { Headphones } from "lucide-react"

import { ContactButton } from "@/components/knowledge-base/contact-dialog"
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
import { commonQuestions } from "@/lib/knowledge-base"

export default function QuestionsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Common questions
      </h1>
      <p className="mt-4 text-muted-foreground">
        Quick answers for the moments when you are not quite sure what to do.
      </p>

      <Card className="mt-8 shadow-none">
        <CardContent>
          <Accordion>
            {commonQuestions.map((item, index) => (
              <AccordionItem key={item.question} value={`question-${index}`}>
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

      <Card className="mt-6 bg-primary/5 shadow-none ring-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-normal normal-case">
            <Headphones className="size-4 text-primary" /> Still unsure?
          </CardTitle>
          <CardDescription>
            It is always fine to ask the shift lead for help.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <ContactButton className="border border-border px-4" />
        </CardFooter>
      </Card>
    </div>
  )
}
