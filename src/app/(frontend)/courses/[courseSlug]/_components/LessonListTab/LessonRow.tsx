'use client'

import type { ReactNode } from 'react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { storeLessonOpenTimestamp } from '@/infra/analytics/utils/lesson-load-timing'
import { SYSTEM_EVENTS, systemEventBus } from '@/infra/system-events'
import { toast } from 'sonner'
import { cn } from '@/infra/utils/ui'
import type { Lesson } from '@/payload-types'
import type { LessonTimelineEntry, LessonTimelineState } from './lessons-grouping'
import { DurationBadge, StatusBadge } from './LessonRowBadges'
import { LessonStatusControl } from './LessonStatusControl'

interface LessonRowProps {
  entry: LessonTimelineEntry
  courseSlug: string
  chapterSlug: string
  badgeOverride?: ReactNode
}

export function LessonRow({ entry, courseSlug, chapterSlug, badgeOverride }: LessonRowProps) {
  const t = useTranslations('coursePage.lessonsPath')
  const tc = useTranslations('courses')
  const { lesson, state, progress, index } = entry

  const href = `/courses/${courseSlug}/chapters/${chapterSlug}/lessons/${lesson.slug}`
  const isLockedByStatus = lesson.contentStatus === 'soon'
  const isInteractable = state !== 'locked'

  const onActivate = (e: React.MouseEvent) => {
    if (!isInteractable || isLockedByStatus) {
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

  const dotClass = cn(
    'lesson-timeline-dot',
    state === 'completed' && 'lesson-timeline-dot--completed',
    state === 'active' && 'lesson-timeline-dot--active',
  )

  const rowShadow =
    state === 'active'
      ? 'shadow-lesson-active'
      : state === 'completed'
        ? 'shadow-lesson-completed'
        : state === 'locked'
          ? 'shadow-lesson-locked'
          : ''

  const rowClass = cn(
    'flex-1 cursor-pointer rounded-xl border p-4 md:p-5 transition-all duration-normal',
    'flex flex-col sm:flex-row justify-between items-start sm:items-center gap-content-gap',
    'bg-card/40 hover:bg-card/70 border-border/40 hover:border-border/80',
    rowShadow,
    state === 'active' && 'border-primary/40 bg-card/70 hover:bg-card/80',
    state === 'completed' && 'border-success/20',
    state === 'locked' && 'opacity-60 saturate-[0.6]',
  )

  const numberClass = cn(
    'shrink-0 select-none font-mono font-semibold tracking-tight',
    'text-display-sm md:text-display-md',
    state === 'active' && 'text-foreground font-extrabold',
    state === 'completed' && 'text-success/80',
    state === 'locked' && 'text-muted-foreground/50',
    state === 'available' && 'text-muted-foreground',
  )

  const inner = (
    <>
      <RowBody
        lesson={lesson}
        index={index}
        state={state}
        numberClass={numberClass}
        badgeOverride={badgeOverride}
        t={t}
      />
      <LessonStatusControl
        state={state}
        href={href}
        progress={progress}
        onActivate={onActivate}
        t={t}
      />
    </>
  )

  return (
    <div className="relative" data-state={state}>
      <span className={dotClass} aria-hidden />
      <div className="ms-8">
        {isInteractable && !isLockedByStatus ? (
          <a href={href} onClick={onActivate} className={rowClass}>
            {inner}
          </a>
        ) : (
          <div className={rowClass} onClick={onActivate}>
            {inner}
          </div>
        )}
      </div>
    </div>
  )
}

function RowBody({
  lesson,
  index,
  state,
  numberClass,
  badgeOverride,
  t,
}: {
  lesson: Lesson
  index: number
  state: LessonTimelineState
  numberClass: string
  badgeOverride?: ReactNode
  t: (key: string) => string
}) {
  const indexLabel = String(index).padStart(2, '0')
  return (
    <div className="flex items-center gap-content-gap md:gap-content-gap-lg text-start w-full sm:w-auto min-w-0">
      <span className={numberClass}>{indexLabel}</span>
      <div className="w-px h-9 bg-border/60 shrink-0" aria-hidden />
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {badgeOverride ?? <StatusBadge status={state} t={t} />}
          <DurationBadge lesson={lesson} t={t} />
        </div>
        <h3 className="text-heading-sm font-bold text-foreground tracking-tight truncate">
          {lesson.title}
        </h3>
        {lesson.description && (
          <p className="text-body-xs text-muted-foreground line-clamp-2">{lesson.description}</p>
        )}
      </div>
    </div>
  )
}
