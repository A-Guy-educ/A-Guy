/**
 * StatusPill — colored pill showing an exercise's review state.
 *
 * @fileType component
 * @domain admin
 * @ai-summary Colored status pill for lesson duplication review.
 */
'use client'

import { cn } from '@/infra/utils/ui'
import type { ExerciseReviewState } from './lib/exerciseState'

interface StatusPillProps {
  state: ExerciseReviewState
  className?: string
}

const PILL_STYLES: Record<ExerciseReviewState, { label: string; classes: string }> = {
  succeeded: {
    label: 'Succeeded',
    classes:
      'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.3)]',
  },
  needs_review: {
    label: 'Needs Review',
    classes:
      'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.3)]',
  },
  failed: {
    label: 'Failed',
    classes:
      'bg-[hsl(var(--error)/0.15)] text-[hsl(var(--error))] border border-[hsl(var(--error)/0.3)]',
  },
  pending: {
    label: 'Pending',
    classes:
      'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]',
  },
}

export function StatusPill({ state, className }: StatusPillProps) {
  const { label, classes } = PILL_STYLES[state]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label font-semibold',
        classes,
        className,
      )}
    >
      {label}
    </span>
  )
}
