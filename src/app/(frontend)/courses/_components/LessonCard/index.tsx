'use client'

import { SystemLink } from '@/infra/loading/components/SystemLink'
import { cn } from '@/infra/utils/ui'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Card, CardFooter, CardHeader, CardTitle } from '@/ui/web/components/card'
import { Button } from '@/ui/web/components/button'
import { SafeHtml } from '@/ui/web/SafeHtml'
import { ContentStatusBadge } from '@/ui/web/shared/ContentStatusBadge'
import { toast } from 'sonner'

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

  const href = `/courses/${courseSlug}/chapters/${effectiveChapterSlug}/lessons/${lesson.slug}`

  // Determine if lesson is "soon" (locked)
  const isSoon = lesson.contentStatus === 'soon'

  const handleLessonClick = (e: React.MouseEvent) => {
    // If lesson is "Soon", show locked message and prevent navigation
    if (isSoon) {
      e.preventDefault()
      toast.info(t('contentLocked'))
      return
    }
  }

  return (
    <Card className={cn('hover:shadow-md transition-shadow', isSoon && 'opacity-60')}>
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-muted-foreground">
            {t('lesson')} {lesson.order}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CardTitle className="text-xl">{lesson.title}</CardTitle>
          <ContentStatusBadge
            contentStatus={lesson.contentStatus}
            contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
          />
        </div>
        {lesson.description && (
          <SafeHtml html={lesson.description} className="text-sm text-muted-foreground [&_p]:m-0" />
        )}
      </CardHeader>
      <CardFooter>
        <Button asChild={!isSoon}>
          <SystemLink
            href={isSoon ? '#' : href}
            onClick={isSoon ? handleLessonClick : undefined}
            className={isSoon ? 'cursor-not-allowed' : undefined}
          >
            {t('viewLesson')}
          </SystemLink>
        </Button>
      </CardFooter>
    </Card>
  )
}
