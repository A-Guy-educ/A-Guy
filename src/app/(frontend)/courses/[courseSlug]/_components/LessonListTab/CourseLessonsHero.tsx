'use client'

import { RotateCcw, Target } from 'lucide-react'
import { useTranslations } from '@/ui/web/providers/I18n'
import { cn } from '@/infra/utils/ui'
import type { LessonTimelineEntry } from './lessons-grouping'
import { HeroProgressRing } from './HeroProgressRing'

interface CourseLessonsHeroProps {
  overallPercent: number
  totalCount: number
  completedCount: number
  activeEntry: LessonTimelineEntry | undefined
  allCompleted: boolean
  onFocusNext: () => void
  onResetProgress: () => void
}

export function CourseLessonsHero({
  overallPercent,
  totalCount,
  completedCount,
  activeEntry,
  allCompleted,
  onFocusNext,
  onResetProgress,
}: CourseLessonsHeroProps) {
  const t = useTranslations('coursePage.lessonsPath')

  const hasContent = totalCount > 0
  const subtitle = allCompleted ? t('heroAllCompletedSub') : hasContent ? t('heroSubtitle') : ''
  const nextTitle = activeEntry?.lesson.title ?? ''

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card p-card-padding mb-10',
        'shadow-card',
      )}
    >
      <div
        className="pointer-events-none absolute -top-12 -end-12 h-48 w-48 rounded-full bg-primary/5 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -start-12 h-48 w-48 rounded-full bg-primary/5 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-content-gap md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-content-gap w-full md:w-auto">
          <HeroProgressRing percent={overallPercent} />
          <div className="min-w-0">
            <span className="inline-block rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border border-border/60">
              {t('heroEyebrow')}
            </span>
            <h2 className="mt-1.5 text-heading-md font-bold text-foreground tracking-tight truncate">
              {allCompleted
                ? t('heroAllCompleted')
                : hasContent && activeEntry
                  ? `${t('heroNextLessonLabel')} ${nextTitle}`
                  : t('heroAllCompleted')}
            </h2>
            {subtitle && <p className="mt-1 text-body-xs text-muted-foreground">{subtitle}</p>}
            {hasContent && (
              <p className="mt-1 text-body-xs text-muted-foreground/80">
                {completedCount}/{totalCount}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-content-gap-xs w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={onFocusNext}
            disabled={!activeEntry || allCompleted}
            aria-label={t('heroFocusAria')}
            className={cn(
              'flex-1 md:flex-none inline-flex items-center justify-center gap-2',
              'bg-primary text-primary-foreground font-bold text-body-xs',
              'px-5 py-3 rounded-xl shadow-elevation-2 transition-all duration-normal',
              'hover:opacity-90 active:scale-[0.98]',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
            )}
          >
            <Target className="w-3.5 h-3.5" aria-hidden />
            <span>{t('heroFocusButton')}</span>
          </button>
          <button
            type="button"
            onClick={onResetProgress}
            disabled={!hasContent || completedCount === 0}
            aria-label={t('heroResetAria')}
            className={cn(
              'bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground',
              'p-3 rounded-xl border border-border/60 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title={t('heroReset')}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
