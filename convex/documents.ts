import { v, type Infer } from "convex/values"

import {
  isBannerImageContentType,
  MAX_BANNER_IMAGE_SIZE_BYTES,
} from "../lib/banner-image"
import type { Id } from "./_generated/dataModel"
import { mutation, type MutationCtx } from "./_generated/server"
import { requireHubPermission, requireIdentity } from "./lib/access"
import {
  createNotification,
  notifyPublicationChange,
} from "./lib/notifications"

const documentResource = v.union(
  v.object({
    kind: v.literal("file"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
    size: v.number(),
  }),
  v.object({
    kind: v.literal("link"),
    url: v.string(),
  })
)

type DocumentResource = Infer<typeof documentResource>

function required(value: string, label: string, max: number) {
  const clean = value.trim()
  if (!clean) throw new Error(`${label} is required`)
  if (clean.length > max) throw new Error(`${label} is too long`)
  return clean
}

function sharedLink(value: string) {
  const clean = required(value, "Shared link", 2_000)
  let url: URL
  try {
    url = new URL(clean)
  } catch {
    throw new Error("Enter a valid shared link")
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Shared links must use HTTP or HTTPS")
  }
  return url.toString()
}

async function validateResource(
  ctx: MutationCtx,
  resource: DocumentResource
): Promise<DocumentResource> {
  if (resource.kind === "link") {
    return { kind: "link", url: sharedLink(resource.url) }
  }

  const stored = await ctx.db.system.get("_storage", resource.storageId)
  if (!stored) throw new Error("Uploaded file not found")
  const suppliedContentType = resource.contentType.trim().slice(0, 200)
  return {
    kind: "file",
    storageId: resource.storageId,
    name: required(resource.name, "File name", 240),
    contentType:
      stored.contentType || suppliedContentType || "application/octet-stream",
    size: stored.size,
  }
}

export const save = mutation({
  args: {
    hubId: v.id("hubs"),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    resource: v.optional(documentResource),
    bannerStorageId: v.union(v.id("_storage"), v.null()),
    employeeProfileIds: v.array(v.id("employeeProfiles")),
    published: v.boolean(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { permission } = await requireHubPermission(ctx, args.hubId, "editor")
    const identity = await requireIdentity(ctx)
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (!existing && permission === "editor") {
      throw new Error("Full content access is required to create content")
    }

    const resource = args.resource
      ? await validateResource(ctx, args.resource)
      : existing?.resource
    if (!resource && !existing) {
      throw new Error("Upload a file or add a shared link")
    }

    if (args.bannerStorageId) {
      const storedBanner = await ctx.db.system.get(
        "_storage",
        args.bannerStorageId
      )
      if (!storedBanner) throw new Error("Uploaded banner not found")
      if (!isBannerImageContentType(storedBanner.contentType ?? "")) {
        throw new Error("Use a JPG, PNG, WebP, or AVIF banner image")
      }
      if (storedBanner.size > MAX_BANNER_IMAGE_SIZE_BYTES) {
        throw new Error("Banner images must be 10 MB or smaller")
      }
    }

    const value = {
      title: required(args.title, "Document name", 140),
      description: required(args.description, "Document description", 500),
      resource,
      bannerStorageId: args.bannerStorageId ?? undefined,
      published: args.published,
      updatedAt: Date.now(),
      // Remove authored content when a legacy row is next saved.
      type: undefined,
      content: undefined,
    }
    const documentId = existing
      ? (await ctx.db.patch("documents", existing._id, value), existing._id)
      : await ctx.db.insert("documents", {
          hubId: args.hubId,
          slug: required(args.slug, "Document slug", 100),
          ...value,
        })

    const selectedIds = [...new Set(args.employeeProfileIds)].slice(0, 100)
    const oldEmployeeRelations = await ctx.db
      .query("documentEmployees")
      .withIndex("by_documentId_and_employeeProfileId", (q) =>
        q.eq("documentId", documentId)
      )
      .take(200)
    const oldByEmployeeId = new Map(
      oldEmployeeRelations.map((relation) => [
        relation.employeeProfileId,
        relation,
      ])
    )
    for (const employeeProfileId of selectedIds) {
      const profile = await ctx.db.get("employeeProfiles", employeeProfileId)
      if (!profile || profile.hubId !== args.hubId) {
        throw new Error("Employee does not belong to this workplace")
      }
      if (
        profile.status === "deactivated" &&
        !oldByEmployeeId.has(employeeProfileId)
      ) {
        throw new Error("Deactivated employees cannot be added to documents")
      }
      if (!oldByEmployeeId.has(employeeProfileId)) {
        await ctx.db.insert("documentEmployees", {
          hubId: args.hubId,
          documentId,
          employeeProfileId,
          addedAt: Date.now(),
          addedBy: identity.subject,
        })
      }
    }
    const selected = new Set(selectedIds)
    for (const relation of oldEmployeeRelations) {
      if (!selected.has(relation.employeeProfileId)) {
        await ctx.db.delete("documentEmployees", relation._id)
      }
    }

    const oldStorageIds = new Set<Id<"_storage">>()
    if (existing?.resource?.kind === "file") {
      oldStorageIds.add(existing.resource.storageId)
    }
    if (existing?.bannerStorageId) {
      oldStorageIds.add(existing.bannerStorageId)
    }
    const retainedStorageIds = new Set<Id<"_storage">>()
    if (resource?.kind === "file") retainedStorageIds.add(resource.storageId)
    if (args.bannerStorageId)
      retainedStorageIds.add(args.bannerStorageId as Id<"_storage">)
    for (const storageId of oldStorageIds) {
      if (!retainedStorageIds.has(storageId)) {
        await ctx.storage.delete(storageId)
      }
    }

    await notifyPublicationChange(ctx, {
      hubId: args.hubId,
      kind: "document",
      wasPublished: existing?.published ?? false,
      isPublished: args.published,
      contentTitle: value.title,
      detailHref: `/documents/${args.slug}`,
      listHref: "/documents",
      publishedTitle: "New document shared",
      updatedTitle: "Document updated",
      unpublishedTitle: "Document unpublished",
    })
    return args.slug
  },
})

export const remove = mutation({
  args: { hubId: v.id("hubs"), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireHubPermission(ctx, args.hubId, "manager")
    const document = await ctx.db
      .query("documents")
      .withIndex("by_hubId_and_slug", (q) =>
        q.eq("hubId", args.hubId).eq("slug", args.slug)
      )
      .unique()
    if (document) {
      const relations = await ctx.db
        .query("documentEmployees")
        .withIndex("by_documentId_and_employeeProfileId", (q) =>
          q.eq("documentId", document._id)
        )
        .take(200)
      for (const relation of relations) {
        await ctx.db.delete("documentEmployees", relation._id)
      }
      const storageIds = new Set<Id<"_storage">>()
      if (document.resource?.kind === "file") {
        storageIds.add(document.resource.storageId)
      }
      if (document.bannerStorageId) storageIds.add(document.bannerStorageId)
      for (const storageId of storageIds) {
        await ctx.storage.delete(storageId)
      }
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
