'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Chapter } from '@/payload-types'
import { Card, CardHeader, CardTitle, CardDescription } from '@/ui/web/components/card'
import { ProgressCircle } from '@/ui/web/shared/ProgressCircle'

interface TopicCardProps {
  chapter: Chapter
  progress: number // 0-100
  courseSlug: string
}

export function TopicCard({ chapter, progress, courseSlug }: TopicCardProps) {
  if (!chapter.slug) return null

  return (
    <SystemLink href={`/courses/${courseSlug}/chapters/${chapter.slug}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
        <CardHeader className="flex flex-row items-center gap-4">
          <ProgressCircle percentage={progress} size={50} />
          <div className="flex-1 min-w-0">
            {chapter.chapterLabel && (
              <div className="text-xs text-muted-foreground mb-1">{chapter.chapterLabel}</div>
            )}
            <CardTitle className="text-lg truncate">{chapter.title}</CardTitle>
            {chapter.description && (
              <CardDescription className="line-clamp-2 text-sm">
                {chapter.description}
              </CardDescription>
            )}
          </div>
        </CardHeader>
      </Card>
    </SystemLink>
  )
}
