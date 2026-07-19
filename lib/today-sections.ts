export const todaySectionDefinitions = [
  {
    key: "welcome",
    title: "Welcome banner",
    description: "The date, establishment details, and daily introduction.",
  },
  {
    key: "quick-links",
    title: "Quick links",
    description: "Shortcuts to guides, the calendar, and announcements.",
  },
  {
    key: "happening-today",
    title: "Happening today",
    description: "Published events scheduled for the current day.",
  },
  {
    key: "current-announcements",
    title: "Current announcements",
    description: "Active operational updates and notices.",
  },
  {
    key: "coming-next",
    title: "Coming next",
    description: "A preview of the next three upcoming events.",
  },
  {
    key: "useful-guides",
    title: "Useful guides",
    description: "Featured instructions selected for quick access.",
  },
] as const

export type TodaySectionKey = (typeof todaySectionDefinitions)[number]["key"]

export type TodaySectionSetting = {
  key: TodaySectionKey
  visible: boolean
}

const todaySectionKeys = new Set<TodaySectionKey>(
  todaySectionDefinitions.map((section) => section.key)
)

export const defaultTodaySections: TodaySectionSetting[] =
  todaySectionDefinitions.map((section) => ({
    key: section.key,
    visible: true,
  }))

export function normalizeTodaySections(
  sections?: readonly { key: string; visible: boolean }[]
): TodaySectionSetting[] {
  const seen = new Set<TodaySectionKey>()
  const normalized: TodaySectionSetting[] = []

  for (const section of sections ?? []) {
    if (!todaySectionKeys.has(section.key as TodaySectionKey)) continue
    const key = section.key as TodaySectionKey
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push({ key, visible: section.visible })
  }

  for (const section of defaultTodaySections) {
    if (!seen.has(section.key)) normalized.push({ ...section })
  }

  return normalized
}
