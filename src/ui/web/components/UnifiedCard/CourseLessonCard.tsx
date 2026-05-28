'use client'

import { storeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import type { Lesson } from '@/payload-types'
import { useTranslations } from '@/ui/web/providers/I18n'
import { UnifiedCard } from '@/ui/web/components/UnifiedCard'
import type { LessonType } from '@/server/constants/lesson-types'
import { toast } from 'sonner'

interface CourseLessonCardProps {
  lesson: Lesson
  index: number
  courseSlug: string
  chapterSlug: string
  tabColor?: { text: string; stroke: string }
  progress?: number
  /** Lesson type — 'exam' switches label from "Lesson" to "Exam" with larger font */
  lessonType?: LessonType
}

export function CourseLessonCard({
  lesson,
  index,
  courseSlug,
  chapterSlug,
  tabColor,
  progress = 0,
  lessonType,
}: CourseLessonCardProps) {
  const tc = useTranslations('courses')
  const t = useTranslations('coursePage')

  const isExam = lessonType === 'exam'
  const label = `${isExam ? tc('exam') : tc('lesson')} ${index}`
  const labelBadgeClassName = isExam ? 'text-[11.5px]' : undefined

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
      label={label}
      labelBadgeClassName={labelBadgeClassName}
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
