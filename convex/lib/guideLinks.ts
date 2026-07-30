import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

export const MAX_GUIDE_LINKS_PER_ITEM = 100
export const MAX_GUIDE_LINKS_PER_HUB = 1000

export function assertGuideLinksPerItem(count: number) {
  if (count > MAX_GUIDE_LINKS_PER_ITEM) {
    throw new Error("tooManyRelatedGuides")
  }
}

export function assertGuideLinksPerHub(count: number) {
  if (count > MAX_GUIDE_LINKS_PER_HUB) {
    throw new Error("tooManyRelatedGuideLinksForWorkplace")
  }
}

export function assertGuideLinkReplacementFits({
  hubCount,
  previousCount,
  nextCount,
}: {
  hubCount: number
  previousCount: number
  nextCount: number
}) {
  assertGuideLinksPerItem(previousCount)
  assertGuideLinksPerItem(nextCount)
  assertGuideLinksPerHub(hubCount)
  assertGuideLinksPerHub(hubCount - previousCount + nextCount)
}

export async function resolvePublishedGuides(
  ctx: MutationCtx,
  args: {
    hubId: Id<"hubs">
    slugs: string[]
  }
): Promise<Doc<"guides">[]> {
  const slugs = [
    ...new Set(args.slugs.map((slug) => slug.trim()).filter(Boolean)),
  ]
  assertGuideLinksPerItem(slugs.length)

  return await Promise.all(
    slugs.map(async (slug) => {
      const guide = await ctx.db
        .query("guides")
        .withIndex("by_hubId_and_slug", (q) =>
          q.eq("hubId", args.hubId).eq("slug", slug)
        )
        .unique()
      if (!guide) throw new Error("guideNotFound")
      if (!guide.published) throw new Error("relatedGuidesMustBePublished")
      return guide
    })
  )
}
