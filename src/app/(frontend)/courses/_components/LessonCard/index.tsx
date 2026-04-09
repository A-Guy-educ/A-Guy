'use client'

import { storeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SystemLink } from '@/infra/loading/components/SystemLink'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
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

    // Track lesson open attempt
    storeLessonOpenTimestamp(lesson.id)
    systemEventBus.emit(SYSTEM_EVENTS.LESSON_OPEN_ATTEMPTED, {
      lesson_id: lesson.id,
      content_type: (lesson.contentFiles?.length ?? 0) > 0 ? 'pdf' : 'exercises',
      platform: 'web',
      course_id: courseSlug,
    })
  }

  return (
    <Card
      className={cn(
        'relative border-s-4 border-s-primary hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.98] will-change-transform',
        isSoon && 'opacity-60',
      )}
    >
      <ContentStatusBadge
        contentStatus={lesson.contentStatus}
        contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
        contentStatusLabel={lesson.contentStatusLabel ?? undefined}
        className="absolute -top-3 right-4 z-10"
      />
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-body-sm font-semibold text-muted-foreground">
            {t('lesson')} {lesson.order}
          </span>
        </div>
        <CardTitle>{lesson.title}</CardTitle>
        {lesson.description && (
          <SafeHtml
            html={lesson.description}
            className="text-body-sm text-muted-foreground line-clamp-2 [&_p]:m-0"
          />
        )}
      </CardHeader>
      <CardFooter>
        {isSoon ? (
          // Locked "Soon" lesson: standalone button (no SystemLink) to avoid invalid <button><a> nesting
          // Don't use disabled - we need onClick to fire so the toast shows (AC-2)
          <Button onClick={handleLessonClick} className="cursor-not-allowed">
            {t('viewLesson')}
          </Button>
        ) : (
          // Normal lesson: Button with asChild renders SystemLink as the button element
          <Button asChild>
            <SystemLink href={href} onClick={handleLessonClick}>
              {t('viewLesson')}
            </SystemLink>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
