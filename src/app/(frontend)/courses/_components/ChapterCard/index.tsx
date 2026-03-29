'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Chapter } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardFooter, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { cn } from '@/infra/utils/ui'

interface ChapterCardProps {
  chapter: Chapter
  courseSlug: string
}

export function ChapterCard({ chapter, courseSlug }: ChapterCardProps) {
  const t = useTranslations('courses')

  if (!chapter.slug) {
    return null
  }

  return (
    <Card className={cn('hover:shadow-card-hover hover:border-primary/15 transition-all duration-normal')}>
      <CardHeader>
        {chapter.chapterLabel && (
          <div className="mb-2">
            <span className="text-body-sm font-semibold text-muted-foreground">
              {t('chapter')} {chapter.chapterLabel}
            </span>
          </div>
        )}
        <CardTitle className="text-heading-lg">{chapter.title}</CardTitle>
        {chapter.description && (
          <SafeHtml
            html={chapter.description}
            className="text-body-sm text-muted-foreground [&_p]:m-0"
          />
        )}
      </CardHeader>
      <CardFooter>
        <Button asChild>
          <SystemLink href={`/courses/${courseSlug}/chapters/${chapter.slug}`}>
            {t('viewChapter')}
          </SystemLink>
        </Button>
      </CardFooter>
    </Card>
  )
}
