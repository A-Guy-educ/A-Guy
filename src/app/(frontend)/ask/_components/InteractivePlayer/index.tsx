'use client'

import { cn } from '@/infra/utils/ui'
import { useTranslations } from '@/ui/web/providers/I18n'
import { Play, RotateCcw } from 'lucide-react'
import { useMemo } from 'react'
import type { InteractivePlayerProps } from './interactive-player-types'
import { GeometryCanvas } from './GeometryCanvas'
import { ProofTable } from './ProofTable'
import { useInteractivePlayer } from './useInteractivePlayer'
import { useStepAudio } from './useStepAudio'

/**
 * Full-screen interactive lesson player.
 * Shows a geometry SVG canvas on top, play/reset buttons,
 * a proof table with progressive row reveal, and an explanation box.
 */
export function InteractivePlayer({ lesson, onStepChange }: InteractivePlayerProps) {
  const t = useTranslations('homepage.ask.player')
  const player = useInteractivePlayer(lesson, onStepChange)

  useStepAudio({
    steps: lesson.steps,
    currentStepIndex: player.currentStepIndex,
    isPlaying: player.isPlaying,
    playbackSpeed: player.playbackSpeed,
  })

  const currentStep = lesson.steps[player.currentStepIndex]

  // Cumulative highlights: all steps up to current
  const { allHighlightSegments, allHighlightPoints } = useMemo(() => {
    const segs: string[][] = []
    const pts: string[] = []
    for (let i = 0; i <= player.currentStepIndex; i++) {
      const step = lesson.steps[i]
      if (step?.highlightSegments) segs.push(...step.highlightSegments)
      if (step?.highlightPoints) pts.push(...step.highlightPoints)
    }
    return { allHighlightSegments: segs, allHighlightPoints: [...new Set(pts)] }
  }, [player.currentStepIndex, lesson.steps])

  // Current step highlights only (for emphasis)
  const currentHighlightSegments = currentStep?.highlightSegments || []
  const currentHighlightPoints = currentStep?.highlightPoints || []

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Title */}
      <div className="text-center py-section-xs px-4">
        <h2 className="text-heading-lg font-black text-card-foreground">{lesson.title}</h2>
        <p className="text-body-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Canvas area — geometry diagram OR equation display */}
      <div className="mx-4 rounded-2xl border border-border bg-card p-card-padding-sm shadow-elevation-1 min-h-[280px] flex items-center justify-center">
        {lesson.geometry.points.length > 0 ? (
          <GeometryCanvas
            geometry={lesson.geometry}
            highlightSegments={currentHighlightSegments}
            highlightPoints={currentHighlightPoints}
            allHighlightSegments={allHighlightSegments}
            allHighlightPoints={allHighlightPoints}
          />
        ) : (
          <EquationDisplay claim={currentStep?.claim || ''} title={currentStep?.title || ''} />
        )}
      </div>

      {/* Play / Reset buttons */}
      <div className="flex justify-center gap-3 py-section-xs">
        <button
          onClick={player.isPlaying ? player.pause : player.play}
          className={cn(
            'flex items-center gap-content-gap-xs px-6 py-2.5 rounded-full font-bold transition-all duration-normal',
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevation-2',
          )}
        >
          <Play className="w-4 h-4" />
          {player.isPlaying ? t('playing') : t('playButton')}
        </button>
        <button
          onClick={() => player.goToStep(0)}
          className="flex items-center gap-content-gap-xs px-5 py-2.5 rounded-full font-bold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors duration-normal"
        >
          <RotateCcw className="w-4 h-4" />
          {t('resetButton')}
        </button>
      </div>

      {/* Proof table */}
      <div className="px-4 pb-3">
        <ProofTable
          steps={lesson.steps}
          currentStepIndex={player.currentStepIndex}
          totalSteps={lesson.steps.length}
        />
      </div>

      {/* Explanation box */}
      {currentStep && (
        <div className="mx-4 mb-4 px-5 py-section-xs rounded-xl bg-primary/5 border border-primary/20">
          <p className="text-body-sm text-foreground leading-relaxed">
            {currentStep.explanation || currentStep.narration}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Fallback display for non-geometric problems (algebra, calculus, etc).
 * Shows the current step's claim prominently as the "visual" content.
 */
function EquationDisplay({ claim, title }: { claim: string; title: string }) {
  return (
    <div className="text-center w-full px-6 py-section-xs">
      {title && <div className="text-body-sm text-muted-foreground mb-3">{title}</div>}
      <div className="text-heading-xl font-bold text-foreground leading-relaxed break-words">
        {claim}
      </div>
    </div>
  )
}
