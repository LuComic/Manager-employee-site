import { v, type Infer } from "convex/values"

import {
  isBannerImageContentType,
  MAX_BANNER_IMAGE_SIZE_BYTES,
} from "../lib/banner-image"
import type { Doc, Id } from "./_generated/dataModel"
import { mutation, type MutationCtx } from "./_generated/server"
import { requireHubPermission, requireIdentity } from "./lib/access"
import {
  bindHubStorage,
  deleteReferencedHubStorage,
  requireBoundHubStorage,
  requirePendingHubStorage,
} from "./lib/hubStorage"
import {
  createNotification,
  notifyPublicationChange,
} from "./lib/notifications"

const documentResourceInput = v.union(
  v.object({
    kind: v.literal("file"),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.string(),
  }),
  v.object({
    kind: v.literal("link"),
    url: v.string(),
  })
)

type DocumentResourceInput = Infer<typeof documentResourceInput>

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
  hubId: Id<"hubs">,
  resource: DocumentResourceInput
): Promise<Doc<"documents">["resource"]> {
  if (resource.kind === "link") {
    return { kind: "link", url: sharedLink(resource.url) }
  }

  const { stored } = await requirePendingHubStorage(
    ctx,
    hubId,
    resource.storageId
  )
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
    resource: v.optional(documentResourceInput),
    bannerStorageId: v.optional(v.union(v.id("_storage"), v.null())),
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
      ? await validateResource(ctx, args.hubId, args.resource)
      : existing?.resource
    if (!resource) throw new Error("Upload a file or add a shared link")

    if (!args.resource && existing?.resource.kind === "file") {
      await requireBoundHubStorage(
        ctx,
        args.hubId,
        existing.resource.storageId,
        {
          kind: "documentResource",
          documentId: existing._id,
        }
      )
    }

    const bannerStorageId =
      args.bannerStorageId === undefined
        ? existing?.bannerStorageId
        : (args.bannerStorageId ?? undefined)

    if (args.bannerStorageId) {
      const { stored: storedBanner } = await requirePendingHubStorage(
        ctx,
        args.hubId,
        args.bannerStorageId
      )
      if (!isBannerImageContentType(storedBanner.contentType ?? "")) {
        throw new Error("Use a JPG, PNG, WebP, or AVIF banner image")
      }
      if (storedBanner.size > MAX_BANNER_IMAGE_SIZE_BYTES) {
        throw new Error("Banner images must be 10 MB or smaller")
      }
    }
    if (args.bannerStorageId === undefined && existing?.bannerStorageId) {
      await requireBoundHubStorage(ctx, args.hubId, existing.bannerStorageId, {
        kind: "documentBanner",
        documentId: existing._id,
      })
    }

    const selectedIds = [...new Set(args.employeeProfileIds)].slice(0, 100)
    const selectedProfiles = await Promise.all(
      selectedIds.map(async (employeeProfileId) => {
        const profile = await ctx.db.get("employeeProfiles", employeeProfileId)
        if (!profile || profile.hubId !== args.hubId) {
          throw new Error("Employee does not belong to this workplace")
        }
        return profile
      })
    )

    const value = {
      title: required(args.title, "Document name", 140),
      description: required(args.description, "Document description", 500),
      resource,
      bannerStorageId,
      published: args.published,
      updatedAt: Date.now(),
    }
    const documentId = existing
      ? (await ctx.db.patch("documents", existing._id, value), existing._id)
      : await ctx.db.insert("documents", {
          hubId: args.hubId,
          slug: required(args.slug, "Document slug", 100),
          ...value,
        })

    if (args.resource?.kind === "file") {
      await bindHubStorage(ctx, args.hubId, args.resource.storageId, {
        kind: "documentResource",
        documentId,
      })
    }
    if (args.bannerStorageId) {
      await bindHubStorage(ctx, args.hubId, args.bannerStorageId, {
        kind: "documentBanner",
        documentId,
      })
    }

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
    for (const profile of selectedProfiles) {
      const employeeProfileId = profile._id
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
          addedBy: identity.tokenIdentifier,
        })
      }
    }
    const selected = new Set(selectedIds)
    for (const relation of oldEmployeeRelations) {
      if (!selected.has(relation.employeeProfileId)) {
        await ctx.db.delete("documentEmployees", relation._id)
      }
    }

    if (
      existing?.resource.kind === "file" &&
      (resource.kind !== "file" ||
        resource.storageId !== existing.resource.storageId)
    ) {
      await deleteReferencedHubStorage(ctx, {
        hubId: args.hubId,
        storageId: existing.resource.storageId,
        binding: {
          kind: "documentResource",
          documentId: existing._id,
        },
      })
    }
    if (
      existing?.bannerStorageId &&
      existing.bannerStorageId !== bannerStorageId
    ) {
      await deleteReferencedHubStorage(ctx, {
        hubId: args.hubId,
        storageId: existing.bannerStorageId,
        binding: {
          kind: "documentBanner",
          documentId: existing._id,
        },
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
      publishedTitleKey: "notificationNewDocumentShared",
      updatedTitleKey: "notificationDocumentUpdated",
      unpublishedTitleKey: "notificationDocumentUnpublished",
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
      if (document.resource.kind === "file") {
        await deleteReferencedHubStorage(ctx, {
          hubId: args.hubId,
          storageId: document.resource.storageId,
          binding: {
            kind: "documentResource",
            documentId: document._id,
          },
        })
      }
      if (document.bannerStorageId) {
        await deleteReferencedHubStorage(ctx, {
          hubId: args.hubId,
          storageId: document.bannerStorageId,
          binding: {
            kind: "documentBanner",
            documentId: document._id,
          },
        })
      }
      await ctx.db.delete("documents", document._id)
      if (document.published) {
        await createNotification(ctx, {
          hubId: args.hubId,
          audience: "employees",
          kind: "document",
          titleKey: "notificationDocumentRemoved",
          message: document.title,
          href: "/documents",
        })
      }
    }
    return null
  },
})
