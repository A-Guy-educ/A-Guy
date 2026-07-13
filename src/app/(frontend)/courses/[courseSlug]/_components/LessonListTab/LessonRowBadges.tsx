'use client'

import { Clock } from 'lucide-react'
import type { Lesson } from '@/payload-types'
import type { LessonTimelineState } from './lessons-grouping'

interface StatusBadgeProps {
  status: LessonTimelineState
  t: (key: string) => string
}

export function StatusBadge({ status, t }: StatusBadgeProps) {
  if (status === 'completed') return null
  if (status === 'active') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
        {t('lessonInProgressBadge')}
      </span>
    )
  }
  if (status === 'locked') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground">
        {t('lessonLockedStatus')}
      </span>
    )
  }
  return null
}

interface DurationBadgeProps {
  lesson: Lesson
  t: (key: string) => string
}

export function DurationBadge({ lesson, t }: DurationBadgeProps) {
  const minutes = estimateMinutes(lesson)
  if (!minutes) return null
  return (
    <span className="inline-flex items-center gap-1 text-body-xs text-muted-foreground font-mono">
      <Clock className="w-3 h-3" aria-hidden />
      <span>{t('lessonMinutes').replace('{minutes}', String(minutes))}</span>
    </span>
  )
}

function estimateMinutes(lesson: Lesson): number {
  const fileCount = Array.isArray(lesson.contentFiles) ? lesson.contentFiles.length : 0
  if (fileCount === 0) return 15
  if (fileCount === 1) return 25
  return Math.min(60, 20 + fileCount * 10)
}
