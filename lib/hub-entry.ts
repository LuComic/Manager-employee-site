export type HubEntry = {
  slug: string
  credential?: string
}

export function parseHubEntry(
  workplace: string,
  employeeCode: string,
  origin: string
): HubEntry | null {
  const value = workplace.trim()
  if (!value) return null

  let slug = value
  let credential = employeeCode.trim() || undefined
  if (/^(?:https?:\/\/|\/|\?)/i.test(value)) {
    try {
      const url = new URL(value, origin)
      slug = url.searchParams.get("hub")?.trim() ?? ""
      credential ||=
        new URLSearchParams(url.hash.slice(1)).get("access")?.trim() ||
        undefined
    } catch {
      return null
    }
  }

  slug = slug.toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  return { slug, credential }
}

export function hubEntryHref(entry: HubEntry) {
  const query = new URLSearchParams({ hub: entry.slug })
  const fragment = entry.credential
    ? `#access=${encodeURIComponent(entry.credential)}`
    : ""
  return `/?${query.toString()}${fragment}`
}
