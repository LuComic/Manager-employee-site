"use client"

import { T } from "@/components/translated-text"

import { Headphones } from "lucide-react"

import { ContactButton } from "@/components/knowledge-base/contact-dialog"
import { AreaIconTile } from "@/components/operations/area-icon-tile"
import { EmptyState } from "@/components/operations/empty-state"
import { PageHeading } from "@/components/operations/page-heading"
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
import { areaStyles } from "@/lib/area-styles"

export default function QuestionsPage() {
  const { faqs } = useOperations()

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        area="questions"
        title="commonQuestions"
        description="quickAnswersMomentsNotQuiteSureWhat"
      />

      {faqs.length ? (
        <Card size="sm" className="mt-6 shadow-none">
          <CardContent>
            <Accordion>
              {faqs.map((item) => (
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
        <div className="mt-6">
          <EmptyState
            area="questions"
            icon={Headphones}
            title="noCommonQuestionsYet"
            description="answersAppearHereOnceAddedStillAskHelpMessage"
          />
        </div>
      )}

      <Card
        size="sm"
        className={`mt-6 border-l-2 shadow-none ${areaStyles.questions.rail}`}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base tracking-normal normal-case">
            <AreaIconTile
              area="questions"
              icon={Headphones}
              className="size-8"
            />
            <T>stillUnsure</T>
          </CardTitle>
          <CardDescription>
            <T>alwaysFineAskHelpUnsure</T>
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <ContactButton className="border border-border px-4" />
        </CardFooter>
      </Card>
    </div>
  )
}
