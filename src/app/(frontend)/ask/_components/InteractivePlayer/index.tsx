'use client'

import type { InteractivePlayerProps } from './interactive-player-types'
import { PlayerControls } from './PlayerControls'
import { StepRenderer } from './StepRenderer'
import { useInteractivePlayer } from './useInteractivePlayer'
import { useStepAudio } from './useStepAudio'

/**
 * Interactive lesson player — renders step-by-step HTML animations
 * with playback controls (play/pause, speed, scrub).
 * Slots into the existing Ask page content pane.
 */
export function InteractivePlayer({ lesson, onStepChange }: InteractivePlayerProps) {
  const player = useInteractivePlayer(lesson, onStepChange)

  const { currentStepIndex, isPlaying, playbackSpeed, stepProgress, ...actions } = player
  const state = {
    currentStepIndex,
    isPlaying,
    playbackSpeed,
    stepProgress,
    elapsedTime: player.elapsedTime,
  }

  // A/V sync — plays TTS audio matched to current step, speed, and play state
  useStepAudio({ steps: lesson.steps, currentStepIndex, isPlaying, playbackSpeed })

  const currentStep = lesson.steps[currentStepIndex]

  return (
    <div className="flex flex-col h-full rounded-2xl bg-card border border-border/40 shadow-elevation-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h2 className="text-heading-sm font-bold text-card-foreground truncate">{lesson.title}</h2>
        {currentStep && (
          <p className="text-body-xs text-muted-foreground mt-0.5 truncate">{currentStep.title}</p>
        )}
      </div>

      {/* Step content */}
      <StepRenderer lesson={lesson} currentStepIndex={currentStepIndex} />

      {/* Narration caption (always visible as closed-caption fallback) */}
      {currentStep && (
        <div className="px-4 py-2 bg-muted/30 border-t border-border">
          <p className="text-body-sm text-muted-foreground italic line-clamp-2">
            {currentStep.narration}
          </p>
        </div>
      )}

      {/* Playback controls */}
      <PlayerControls state={state} actions={actions} totalSteps={lesson.steps.length} />
    </div>
  )
}
