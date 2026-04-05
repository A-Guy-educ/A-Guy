'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { InteractiveLesson } from '@/infra/llm/services/interactive-lesson/interactive-lesson-types'
import type { PlaybackSpeed, PlayerActions, PlayerState } from './interactive-player-types'

/**
 * Hook managing playback state for the interactive lesson player.
 * Handles play/pause, step transitions, speed changes, and progress tracking.
 */
export function useInteractivePlayer(
  lesson: InteractiveLesson,
  onStepChange?: (stepId: number) => void,
): PlayerState & PlayerActions {
  const [state, setState] = useState<PlayerState>({
    currentStepIndex: 0,
    isPlaying: false,
    playbackSpeed: 1,
    stepProgress: 0,
    elapsedTime: 0,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const totalSteps = lesson.steps.length
  const currentStep = lesson.steps[state.currentStepIndex]

  // Notify parent when step changes
  useEffect(() => {
    if (currentStep) {
      onStepChange?.(currentStep.id)
    }
  }, [state.currentStepIndex, currentStep, onStepChange])

  // Playback timer — ticks every 100ms, adjusted by speed
  useEffect(() => {
    if (!state.isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const tickMs = 100
    timerRef.current = setInterval(() => {
      const s = stateRef.current
      const step = lesson.steps[s.currentStepIndex]
      if (!step) return

      const increment = (tickMs / 1000) * s.playbackSpeed
      const newElapsed = s.elapsedTime + increment
      const newProgress = Math.min(s.stepProgress + increment / step.durationSeconds, 1)

      if (newProgress >= 1) {
        // Move to next step or stop at end
        if (s.currentStepIndex < totalSteps - 1) {
          setState((prev) => ({
            ...prev,
            currentStepIndex: prev.currentStepIndex + 1,
            stepProgress: 0,
            elapsedTime: newElapsed,
          }))
        } else {
          setState((prev) => ({ ...prev, isPlaying: false, stepProgress: 1 }))
        }
      } else {
        setState((prev) => ({
          ...prev,
          stepProgress: newProgress,
          elapsedTime: newElapsed,
        }))
      }
    }, tickMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state.isPlaying, lesson.steps, totalSteps])

  const play = useCallback(() => setState((s) => ({ ...s, isPlaying: true })), [])
  const pause = useCallback(() => setState((s) => ({ ...s, isPlaying: false })), [])
  const togglePlayPause = useCallback(
    () => setState((s) => ({ ...s, isPlaying: !s.isPlaying })),
    [],
  )

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalSteps) return
      setState((s) => ({ ...s, currentStepIndex: index, stepProgress: 0 }))
    },
    [totalSteps],
  )

  const nextStep = useCallback(() => {
    setState((s) => {
      if (s.currentStepIndex >= totalSteps - 1) return s
      return { ...s, currentStepIndex: s.currentStepIndex + 1, stepProgress: 0 }
    })
  }, [totalSteps])

  const prevStep = useCallback(() => {
    setState((s) => {
      if (s.currentStepIndex <= 0) return s
      return { ...s, currentStepIndex: s.currentStepIndex - 1, stepProgress: 0 }
    })
  }, [])

  const setSpeed = useCallback(
    (speed: PlaybackSpeed) => setState((s) => ({ ...s, playbackSpeed: speed })),
    [],
  )

  const seekToProgress = useCallback(
    (progress: number) =>
      setState((s) => ({ ...s, stepProgress: Math.max(0, Math.min(1, progress)) })),
    [],
  )

  return {
    ...state,
    play,
    pause,
    togglePlayPause,
    goToStep,
    nextStep,
    prevStep,
    setSpeed,
    seekToProgress,
  }
}
