'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Chapter } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'
import { HtmlRenderer } from '@/ui/web/shared/HtmlRenderer'

interface ChapterCardProps {
  chapter: Chapter
  courseSlug: string
}

function renderDescription(description: string | null | undefined): React.ReactNode {
  if (!description) return null
  if (typeof description === 'string') {
    return (
      <CardDescription>
        <HtmlRenderer html={description} />
      </CardDescription>
    )
  }
  return null
}

export function ChapterCard({ chapter, courseSlug }: ChapterCardProps) {
  const t = useTranslations('courses')

  if (!chapter.slug) {
    return null
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        {chapter.chapterLabel && (
          <div className="mb-2">
            <span className="text-sm font-semibold text-muted-foreground">
              {t('chapter')} {chapter.chapterLabel}
            </span>
          </div>
        )}
        <CardTitle className="text-xl">{chapter.title}</CardTitle>
        {renderDescription(chapter.description)}
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
