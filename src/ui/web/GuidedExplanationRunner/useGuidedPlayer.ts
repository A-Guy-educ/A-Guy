'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GuidedExplanationStep,
  GuidedExplanationV1,
} from '@/infra/contracts/guided-explanation/v1'
import { runAction, resetScene, type PausableAnimation } from './sceneActions'
import { cancelSpeech, primeSpeechVoices, startSpeech, stripNiqqud } from './speech'

/** Fired to the window so sibling UI (e.g. chat panel) knows the active step. */
const STEP_CONTEXT_EVENT = 'ask-step-context'

interface StepContextDetail {
  currentStepId: number
  totalSteps: number
  stepTitle: string
  stepNarration: string
}

function emitStepContext(detail: StepContextDetail | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STEP_CONTEXT_EVENT, { detail }))
}

interface UseGuidedPlayerArgs {
  payload: GuidedExplanationV1
  containerRef: React.MutableRefObject<HTMLElement | null>
}

interface UseGuidedPlayerResult {
  isPlaying: boolean
  isPaused: boolean
  narrationText: string
  currentStep: number
  totalSteps: number
  speed: number
  play: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setSpeed: (rate: number) => void
}

/**
 * State machine driving the guided explanation sequence.
 *
 * Cancellation: monotonic counter (`sequenceRef`) — each play captures the
 * counter; reset/replay bumps it; in-flight async work bails out the next
 * tick when its captured value no longer matches.
 *
 * Pause: the currently-running Anime.js animation OR audio is registered via
 * `activeAnimationRef`; pause/resume pipe through to it natively. A
 * `pausedRef` + `waitWhilePaused()` guards the gaps between animations.
 *
 * Speed: `speedRef` is read by animation/speech creators so new ops spawn at
 * the current rate; `setSpeed()` also forwards to the active instance via
 * its `setRate()` hook for live changes.
 */
export function useGuidedPlayer({
  payload,
  containerRef,
}: UseGuidedPlayerArgs): UseGuidedPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [narrationText, setNarrationText] = useState(payload.narrationBox.placeholder)
  const [currentStep, setCurrentStep] = useState(0)
  const [speed, setSpeedState] = useState(1)
  const sequenceRef = useRef(0)
  const speedRef = useRef(1)

  // Pause primitives — resolver is replaced with a new pending promise on pause,
  // and called/cleared on resume so awaiting ops continue.
  const pausedRef = useRef(false)
  const pauseResolverRef = useRef<(() => void) | null>(null)
  const activeAnimationRef = useRef<PausableAnimation | null>(null)

  const totalSteps = payload.steps.length

  useEffect(() => {
    primeSpeechVoices()
    return () => {
      cancelSpeech()
      emitStepContext(null)
    }
  }, [])

  const waitWhilePaused = useCallback(async (): Promise<void> => {
    if (!pausedRef.current) return
    await new Promise<void>((resolve) => {
      pauseResolverRef.current = resolve
    })
  }, [])

  const registerAnimation = useCallback((anim: PausableAnimation | null) => {
    activeAnimationRef.current = anim
  }, [])

  const getSpeed = useCallback(() => speedRef.current, [])

  const setSpeed = useCallback((rate: number) => {
    speedRef.current = rate
    setSpeedState(rate)
    activeAnimationRef.current?.setRate?.(rate)
  }, [])

  const reset = useCallback(() => {
    sequenceRef.current += 1
    pausedRef.current = false
    if (pauseResolverRef.current) {
      pauseResolverRef.current()
      pauseResolverRef.current = null
    }
    activeAnimationRef.current?.cancel?.()
    activeAnimationRef.current = null
    cancelSpeech()
    setIsPlaying(false)
    setIsPaused(false)
    setCurrentStep(0)
    setNarrationText(payload.narrationBox.placeholder)
    if (containerRef.current) resetScene(containerRef.current)
    emitStepContext(null)
  }, [payload.narrationBox.placeholder, containerRef])

  const pause = useCallback(() => {
    if (!isPlaying || pausedRef.current) return
    pausedRef.current = true
    setIsPaused(true)
    activeAnimationRef.current?.pause()
  }, [isPlaying])

  const resume = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    setIsPaused(false)
    activeAnimationRef.current?.play()
    if (pauseResolverRef.current) {
      pauseResolverRef.current()
      pauseResolverRef.current = null
    }
  }, [])

  const play = useCallback(() => {
    if (isPlaying) return
    const root = containerRef.current
    if (!root) return

    sequenceRef.current += 1
    const mySequence = sequenceRef.current
    const shouldCancel = () => sequenceRef.current !== mySequence

    setIsPlaying(true)
    setIsPaused(false)
    pausedRef.current = false

    void (async () => {
      try {
        for (let i = 0; i < payload.steps.length; i++) {
          const step = payload.steps[i]
          if (shouldCancel()) return
          await waitWhilePaused()
          if (shouldCancel()) return
          setCurrentStep(i + 1)
          emitStepContext({
            currentStepId: i + 1,
            totalSteps,
            stepTitle: step.title ?? '',
            stepNarration: step.narrate?.display ?? '',
          })
          await runStep(step, {
            root,
            locale: payload.locale,
            shouldCancel,
            waitWhilePaused,
            registerAnimation,
            getSpeed,
            setNarrationText,
          })
        }
      } finally {
        if (!shouldCancel()) {
          setIsPlaying(false)
          setIsPaused(false)
          pausedRef.current = false
          activeAnimationRef.current = null
        }
      }
    })()
  }, [
    isPlaying,
    payload.steps,
    payload.locale,
    totalSteps,
    containerRef,
    waitWhilePaused,
    registerAnimation,
    getSpeed,
  ])

  return {
    isPlaying,
    isPaused,
    narrationText,
    currentStep,
    totalSteps,
    speed,
    play,
    pause,
    resume,
    reset,
    setSpeed,
  }
}

// ---------------------------------------------------------------------------

interface RunStepCtx {
  root: HTMLElement
  locale: string
  shouldCancel: () => boolean
  waitWhilePaused: () => Promise<void>
  registerAnimation: (anim: PausableAnimation | null) => void
  getSpeed: () => number
  setNarrationText: (text: string) => void
}

async function runStep(step: GuidedExplanationStep, ctx: RunStepCtx): Promise<void> {
  for (const action of step.actions) {
    if (ctx.shouldCancel()) return
    await ctx.waitWhilePaused()
    if (ctx.shouldCancel()) return
    await runAction(action, {
      root: ctx.root,
      shouldCancel: ctx.shouldCancel,
      registerAnimation: ctx.registerAnimation,
      getSpeed: ctx.getSpeed,
    })
  }
  if (step.narrate && !ctx.shouldCancel()) {
    await ctx.waitWhilePaused()
    if (ctx.shouldCancel()) return
    const display = stripNiqqud(step.narrate.display)
    ctx.setNarrationText(display)
    const toSpeak = step.narrate.speech ?? step.narrate.display
    const handle = await startSpeech(toSpeak, ctx.locale, ctx.getSpeed())
    ctx.registerAnimation(handle)
    await handle.finished
    ctx.registerAnimation(null)
  }
  if (step.wait && !ctx.shouldCancel()) {
    await ctx.waitWhilePaused()
    if (!ctx.shouldCancel()) await new Promise((r) => setTimeout(r, step.wait))
  }
}
