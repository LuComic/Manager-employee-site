"use client"

import { useState } from "react"
import { Building2, LoaderCircle } from "lucide-react"

import { useOperations } from "@/components/providers/operations-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { slugify } from "@/lib/operations"

export function HubSetup() {
  const { createHub } = useOperations()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [pending, setPending] = useState(false)

  return (
    <Card className="mx-auto max-w-xl shadow-none">
      <CardHeader>
        <span className="mb-3 flex size-11 items-center justify-center bg-primary/10 text-primary">
          <Building2 />
        </span>
        <CardTitle>Create your operations hub</CardTitle>
        <CardDescription>
          This creates a hub owned only by your Clerk account and adds editable
          sample content once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setPending(true)
            try {
              await createHub(name, slug, "public")
            } finally {
              setPending(false)
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="hub-name">Hub name</Label>
            <Input
              id="hub-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setSlug(slugify(event.target.value))
              }}
              className="border border-input px-3"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hub-slug">Public address identifier</Label>
            <Input
              id="hub-slug"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              className="border border-input px-3 font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              The employee URL will include{" "}
              <span className="font-mono">?hub={slug || "your-hub"}</span>.
            </p>
          </div>
          <Button
            type="submit"
            disabled={pending || !name.trim() || !slug}
            className="w-full"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Building2 />
            )}
            {pending ? "Creating hub…" : "Create hub with sample content"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
