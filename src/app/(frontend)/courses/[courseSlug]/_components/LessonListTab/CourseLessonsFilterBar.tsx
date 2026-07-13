'use client'

import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'

export type LessonFilterMode = 'all' | 'focus' | 'hideCompleted'

interface CourseLessonsFilterBarProps {
  value: LessonFilterMode
  onChange: (mode: LessonFilterMode) => void
  hasActiveChapter: boolean
}

const MODES: { id: LessonFilterMode; key: 'filterAll' | 'filterFocus' | 'filterHideCompleted' }[] =
  [
    { id: 'all', key: 'filterAll' },
    { id: 'focus', key: 'filterFocus' },
    { id: 'hideCompleted', key: 'filterHideCompleted' },
  ]

/**
 * Three-way filter mode selector for the lessons timeline.
 *
 * - `all`           — every lesson is visible
 * - `focus`         — only the chapter containing the active lesson; falls
 *                     back to "all" when there is no active chapter
 * - `hideCompleted` — completed lessons are filtered out of every chapter
 */
export function CourseLessonsFilterBar({
  value,
  onChange,
  hasActiveChapter,
}: CourseLessonsFilterBarProps) {
  const t = useTranslations('coursePage.lessonsPath')

  return (
    <div className="flex flex-wrap items-center justify-between gap-content-gap mb-8 px-2">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" aria-hidden />
        <span className="text-body-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t('filterEyebrow')}
        </span>
      </div>
      <div
        role="tablist"
        aria-label={t('filterEyebrow')}
        className="flex gap-1.5 bg-muted p-1 rounded-xl border border-border/60"
      >
        {MODES.map((mode) => {
          const selected = value === mode.id
          const disabled = mode.id === 'focus' && !hasActiveChapter
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(mode.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-lg text-body-xs font-medium transition-colors',
                selected
                  ? 'bg-card text-foreground shadow-elevation-1'
                  : 'text-muted-foreground hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {t(mode.key)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
