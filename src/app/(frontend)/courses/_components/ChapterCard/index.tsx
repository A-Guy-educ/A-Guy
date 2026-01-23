'use client'

import Link from 'next/link'
import type { Chapter } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'

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
        {chapter.description && <CardDescription>{chapter.description}</CardDescription>}
      </CardHeader>
      <CardFooter>
        <Button asChild>
          <Link href={`/courses/${courseSlug}/chapters/${chapter.slug}`}>{t('viewChapter')}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
