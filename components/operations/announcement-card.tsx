import { T } from "@/components/translated-text"
import { useLanguageTag } from "@/i18n/use-app-translations"

import { Link } from "@/i18n/navigation"
import { ArrowRight, Pin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate, type Announcement } from "@/lib/operations"
import { richTextToPlainText } from "@/lib/rich-text"

export function AnnouncementCard({
  announcement,
}: {
  announcement: Announcement
}) {
  const languageTag = useLanguageTag()

  return (
    <Link
      href={`/announcements/${announcement.id}`}
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card
        size="sm"
        className="h-full shadow-none transition-colors group-hover:bg-muted/40"
      >
        <CardHeader>
          <div className="mb-2 flex items-center gap-4">
            <Badge
              variant={
                announcement.priority === "Urgent" ? "destructive" : "secondary"
              }
            >
              {announcement.priority}
            </Badge>
            {announcement.pinned && (
              <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Pin className="size-3" /> <T>pinned</T>
              </span>
            )}
          </div>
          <CardTitle className="text-base">{announcement.title}</CardTitle>
          <CardDescription className="line-clamp-3">
            {richTextToPlainText(announcement.content)}
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
          <span>
            <T>until</T>{" "}
            {formatDate(
              `${announcement.expiresAt}T12:00`,
              undefined,
              undefined,
              languageTag
            )}
          </span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </CardFooter>
      </Card>
    </Link>
  )
}
