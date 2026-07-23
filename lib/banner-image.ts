export const BANNER_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const

export const BANNER_IMAGE_ACCEPT = BANNER_IMAGE_CONTENT_TYPES.join(",")
export const MAX_BANNER_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export function isBannerImageContentType(
  value: string
): value is (typeof BANNER_IMAGE_CONTENT_TYPES)[number] {
  return (BANNER_IMAGE_CONTENT_TYPES as readonly string[]).includes(value)
}
