'use client'

import { CheckCircle2, Lock, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LessonTimelineState } from './lessons-grouping'

interface LessonStatusControlProps {
  state: LessonTimelineState
  href: string
  progress: number
  onActivate: (e: React.MouseEvent) => void
  t: (key: string) => string
}

/**
 * Right-hand control rendered inside a lesson row. The variant matches
 * the row state: completed checkmark, lock indicator, or learn-now button.
 */
export function LessonStatusControl({
  state,
  href,
  progress,
  onActivate,
  t,
}: LessonStatusControlProps): ReactNode {
  if (state === 'completed') return <CompletedControl t={t} />
  if (state === 'locked') return <LockedControl t={t} />
  if (state === 'active') {
    return <ActiveControl href={href} progress={progress} onActivate={onActivate} t={t} />
  }
  return null
}

function CompletedControl({ t }: { t: (key: string) => string }) {
  return (
    <span className="text-body-xs font-bold text-success inline-flex items-center gap-1.5 font-mono shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
      <span className="hidden sm:inline">{t('lessonCompletedStatus')}</span>
    </span>
  )
}

function LockedControl({ t }: { t: (key: string) => string }) {
  return (
    <span className="text-body-xs text-muted-foreground inline-flex items-center gap-1.5 shrink-0">
      <Lock className="w-3 h-3" aria-hidden />
      <span className="hidden sm:inline">{t('lessonLockedStatus')}</span>
    </span>
  )
}

function ActiveControl({
  href,
  progress,
  onActivate,
  t,
}: {
  href: string
  progress: number
  onActivate: (e: React.MouseEvent) => void
  t: (key: string) => string
}) {
  return (
    <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between shrink-0">
      {progress > 0 && progress < 100 && (
        <span className="text-[10px] font-bold font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
          {t('lessonPercentInline').replace('{percent}', String(Math.round(progress)))}
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          onActivate(e)
          if (e.defaultPrevented) return
          window.location.href = href
        }}
        className="bg-primary text-primary-foreground font-bold text-[11px] px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1 shadow-elevation-2 active:scale-95 transition-transform"
      >
        <Play className="w-3 h-3 translate-y-[0.5px]" aria-hidden />
        <span>{t('lessonLearnNow')}</span>
      </button>
    </div>
  )
}
