'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import type { InteractiveLessonStep } from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'

interface ProofTableProps {
  steps: InteractiveLessonStep[]
  /** Index of the current active step (0-based) */
  currentStepIndex: number
  /** Total steps to show as empty rows */
  totalSteps: number
}

/**
 * Proof table with progressive row reveal.
 * Rows up to currentStepIndex are filled, rest are empty.
 * Current step row is highlighted.
 */
export function ProofTable({ steps, currentStepIndex, totalSteps }: ProofTableProps) {
  const t = useTranslations('homepage.ask.player')

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[48px_1fr_1fr] bg-muted/50 border-b border-border">
        <div className="px-3 py-2 text-center font-bold text-body-sm text-muted-foreground">#</div>
        <div className="px-4 py-2 font-bold text-body-sm text-muted-foreground border-s border-border">
          {t('claim')}
        </div>
        <div className="px-4 py-2 font-bold text-body-sm text-muted-foreground border-s border-border">
          {t('reason')}
        </div>
      </div>

      {/* Rows */}
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i <= currentStepIndex ? steps[i] : null
        const isCurrent = i === currentStepIndex
        const isFilled = step !== null && step !== undefined

        return (
          <div
            key={i}
            className={cn(
              'grid grid-cols-[48px_1fr_1fr] border-b border-border last:border-b-0 transition-colors duration-slow',
              isCurrent && 'bg-warning/10',
              !isCurrent && isFilled && 'bg-card',
              !isFilled && 'bg-card',
            )}
          >
            <div className="px-3 py-3 text-center font-bold text-body-sm text-muted-foreground">
              {i + 1}
            </div>
            <div className="px-4 py-3 text-body-sm border-s border-border font-medium">
              {isFilled ? step.claim : ''}
            </div>
            <div className="px-4 py-3 text-body-sm border-s border-border text-muted-foreground">
              {isFilled ? step.reason : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}
