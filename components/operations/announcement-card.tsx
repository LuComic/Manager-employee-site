import Link from "next/link"
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

export function AnnouncementCard({
  announcement,
}: {
  announcement: Announcement
}) {
  return (
    <Link
      href={`/announcements/${announcement.id}`}
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
    >
      <Card className="h-full shadow-none transition-shadow group-hover:shadow-md">
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
                <Pin className="size-3" /> Pinned
              </span>
            )}
          </div>
          <CardTitle className="text-base">{announcement.title}</CardTitle>
          <CardDescription>{announcement.message}</CardDescription>
        </CardHeader>
        <CardFooter className="mt-auto justify-between text-xs text-muted-foreground">
          <span>Until {formatDate(`${announcement.expiresAt}T12:00`)}</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </CardFooter>
      </Card>
    </Link>
  )
}
