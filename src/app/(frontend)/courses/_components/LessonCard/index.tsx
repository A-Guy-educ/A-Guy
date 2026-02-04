'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'

interface LessonCardProps {
  lesson: Lesson
  courseSlug: string
  chapterSlug?: string
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('lesson')} {lesson.order}
          </span>
        </div>
        <CardTitle className="text-xl">{lesson.title}</CardTitle>
        {lesson.description && <CardDescription>{lesson.description}</CardDescription>}
      </CardHeader>
      <CardFooter>
        <Button asChild>
          <SystemLink
            href={`/courses/${courseSlug}/chapters/${effectiveChapterSlug}/lessons/${lesson.slug}`}
          >
            {t('viewLesson')}
          </SystemLink>
        </Button>
      </CardFooter>
    </Card>
  )
}
