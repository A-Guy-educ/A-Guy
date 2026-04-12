'use client'

import { storeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import { toast } from 'sonner'

interface CourseLessonCardProps {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
  tabColor?: { text: string; stroke: string }
  progress?: number
}

export function CourseLessonCard({
  lesson,
  index,
  courseSlug,
  chapterSlug,
  tabColor,
  progress = 0,
}: CourseLessonCardProps) {
  const tc = useTranslations('courses')
  const t = useTranslations('coursePage')

  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`
  const isSoon = lesson.contentStatus === 'soon'
  const accentColor = isSoon ? 'hsl(var(--border))' : (tabColor?.stroke ?? 'hsl(var(--primary))')

  const subtitle =
    progress >= 100 ? t('lessonCompleted') : progress > 0 ? t('statusInProgress') : t('notStarted')

  const handleClick = (e: React.MouseEvent) => {
    if (isSoon) {
      e.preventDefault()
      toast.info(tc('contentLocked'))
      return
    }
    storeLessonOpenTimestamp(lesson.id)
    systemEventBus.emit(SYSTEM_EVENTS.LESSON_OPEN_ATTEMPTED, {
      lesson_id: lesson.id,
      content_type: (lesson.contentFiles?.length ?? 0) > 0 ? 'pdf' : 'exercises',
      platform: 'web',
      course_id: courseSlug,
    })
  }

  return (
    <UnifiedCard
      variant="lesson"
      title={lesson.title}
      label={`${tc('lesson')} ${index}`}
      accentColor={accentColor}
      contentStatus={lesson.contentStatus}
      contentStatusExpiresAt={lesson.contentStatusExpiresAt ?? undefined}
      contentStatusLabel={lesson.contentStatusLabel ?? undefined}
      progress={progress}
      subtitle={subtitle}
      cardHref={isSoon ? '#' : href}
      cardOnClick={handleClick}
    />
  )
}
