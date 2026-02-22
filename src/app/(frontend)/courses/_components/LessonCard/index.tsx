'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Lesson } from '@/payload-types'
import { Button } from '@/ui/web/components/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/web/components/card'
import { useTranslations } from '@/ui/web/providers/I18n'
import { HtmlRenderer } from '@/ui/web/shared/HtmlRenderer'

interface LessonCardProps {
  lesson: Lesson
  courseSlug: string
  chapterSlug?: string
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

export function LessonCard({ lesson, courseSlug, chapterSlug }: LessonCardProps) {
  const t = useTranslations('courses')

  if (!lesson.slug) {
    return null
  }

  // Get chapter slug from lesson if not provided
  const chapter = typeof lesson.chapter !== 'string' ? lesson.chapter : null
  const effectiveChapterSlug = chapterSlug || chapter?.slug

  if (!effectiveChapterSlug) {
    return null
  }

  const href = `/courses/${courseSlug}/chapters/${effectiveChapterSlug}/lessons/${lesson.slug}`

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('lesson')} {lesson.order}
          </span>
        </div>
        <CardTitle className="text-xl">{lesson.title}</CardTitle>
        {renderDescription(lesson.description)}
      </CardHeader>
      <CardFooter>
        <Button asChild>
          <SystemLink href={href}>{t('viewLesson')}</SystemLink>
        </Button>
      </CardFooter>
    </Card>
  )
}
