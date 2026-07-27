import type { AppMessageKey } from "@/i18n/messages"

export const todaySectionDefinitions = [
  {
    key: "welcome",
    titleKey: "todayWelcomeBanner",
    descriptionKey: "todayWelcomeBannerDescription",
  },
  {
    key: "quick-links",
    titleKey: "quickLinks",
    descriptionKey: "todayQuickLinksDescription",
  },
  {
    key: "happening-today",
    titleKey: "happeningToday",
    descriptionKey: "todayHappeningDescription",
  },
  {
    key: "current-announcements",
    titleKey: "currentAnnouncements",
    descriptionKey: "todayAnnouncementsDescription",
  },
  {
    key: "coming-next",
    titleKey: "comingNext",
    descriptionKey: "todayComingNextDescription",
  },
  {
    key: "useful-guides",
    titleKey: "usefulGuides",
    descriptionKey: "todayUsefulGuidesDescription",
  },
] as const satisfies ReadonlyArray<{
  key: string
  titleKey: AppMessageKey
  descriptionKey: AppMessageKey
}>

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
