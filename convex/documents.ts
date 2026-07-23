import { v, type Infer } from "convex/values"

import { mutation } from "./_generated/server"
import { requireHubPermission } from "./lib/access"
import {
  createNotification,
  notifyPublicationChange,
} from "./lib/notifications"

const richTextDocument = v.object({
  type: v.literal("doc"),
  content: v.optional(v.array(v.any())),
})

const documentType = v.union(
  v.literal("text"),
  v.literal("table"),
  v.literal("presentation")
)

const documentContent = v.union(
  v.object({
    kind: v.literal("text"),
    body: richTextDocument,
  }),
  v.object({
    kind: v.literal("table"),
    columns: v.array(v.string()),
    showColumnHeaders: v.optional(v.boolean()),
    showRowHeaders: v.optional(v.boolean()),
    rowHeaders: v.optional(v.array(v.string())),
    rows: v.array(v.array(v.string())),
  }),
  v.object({
    kind: v.literal("presentation"),
    slides: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        body: richTextDocument,
      })
    ),
  })
)

type DocumentContent = Infer<typeof documentContent>

function required(value: string, label: string, max: number) {
  const clean = value.trim()
  if (!clean) throw new Error(`${label} is required`)
  if (clean.length > max) throw new Error(`${label} is too long`)
  return clean
}

function validateContent(
  type: "text" | "table" | "presentation",
  content: DocumentContent
): DocumentContent {
  if (content.kind !== type) throw new Error("Document type does not match")
  if (JSON.stringify(content).length > 400_000)
    throw new Error("Document content is too large")

  if (content.kind === "text") return content

  if (content.kind === "table") {
    if (!content.columns.length || content.columns.length > 12)
      throw new Error("Tables need between 1 and 12 columns")
    if (content.rows.length > 100)
      throw new Error("Tables can contain up to 100 rows")
    const columns = content.columns.map((column, index) =>
      required(column, `Column ${index + 1} name`, 100)
    )
    const rows = content.rows.map((row) => {
      if (row.length !== columns.length)
        throw new Error("Every table row must match the column count")
      return row.map((cell) => cell.slice(0, 2_000))
    })
    const rowHeaders =
      content.rowHeaders ?? rows.map((_, index) => `Row ${index + 1}`)
    if (rowHeaders.length !== rows.length)
      throw new Error("Every table row must have a row title")
    return {
      kind: "table" as const,
      columns,
      showColumnHeaders: content.showColumnHeaders ?? true,
      showRowHeaders: content.showRowHeaders ?? true,
      rowHeaders: rowHeaders.map((header, index) =>
        required(header, `Row ${index + 1} title`, 100)
      ),
      rows,
    }
  }

  if (!content.slides.length || content.slides.length > 30)
    throw new Error("Presentations need between 1 and 30 slides")
  const seen = new Set<string>()
  return {
    kind: "presentation" as const,
    slides: content.slides.map((slide, index) => {
      const id = required(slide.id, `Slide ${index + 1} identifier`, 80)
      if (seen.has(id)) throw new Error("Slide identifiers must be unique")
      seen.add(id)
      return {
        id,
        title: required(slide.title, `Slide ${index + 1} title`, 140),
        body: slide.body,
      }
    }),
  }
}

export const save = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    type: documentType,
    content: documentContent,
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!existing && permission === "editor") {
      throw new Error("Full content access is required to create content")
    }
    const value = {
      title: required(args.title, "Document title", 140),
      description: required(args.description, "Document description", 500),
      type: args.type,
      content: validateContent(args.type, args.content),
      published: args.published,
      updatedAt: Date.now(),
    }
    if (existing) await ctx.db.patch("documents", existing._id, value)
    else {
      await ctx.db.insert("documents", {
        hubId: args.hubId,
        slug: required(args.slug, "Document slug", 100),
        ...value,
      })
    }
    await notifyPublicationChange(ctx, {
      hubId: args.hubId,
      kind: "document",
      wasPublished: existing?.published ?? false,
      isPublished: args.published,
      contentTitle: value.title,
      detailHref: `/documents/${args.slug}`,
      listHref: "/documents",
      publishedTitle: "New document published",
      updatedTitle: "Document updated",
      unpublishedTitle: "Document unpublished",
    })
    return args.slug
  },
})

export const remove = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    const document = await ctx.db
      .query("documents")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (document) {
      await ctx.db.delete("documents", document._id)
      if (document.published) {
        await createNotification(ctx, {
          hubId: args.hubId,
          audience: "employees",
          kind: "document",
          title: "Document removed",
          message: document.title,
          href: "/documents",
        })
      }
    }
    return null
  },
})
