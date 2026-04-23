'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GuidedExplanationStep,
  GuidedExplanationV1,
} from '@/infra/contracts/guided-explanation/v1'
import { runAction, resetScene, type PausableAnimation } from './sceneActions'
import { cancelSpeech, primeSpeechVoices, speak, stripNiqqud } from './speech'

interface UseGuidedPlayerArgs {
  payload: GuidedExplanationV1
  containerRef: React.MutableRefObject<HTMLElement | null>
}

interface UseGuidedPlayerResult {
  isPlaying: boolean
  isPaused: boolean
  narrationText: string
  play: () => void
  pause: () => void
  resume: () => void
  reset: () => void
}

/**
 * State machine driving the guided explanation sequence.
 *
 * Cancellation: monotonic counter (`sequenceRef`) — each play captures the
 * counter; reset/replay bumps it; in-flight async work bails out the next
 * tick when its captured value no longer matches.
 *
 * Pause: the currently-running Anime.js animation is registered via
 * `activeAnimationRef`; pause/resume pipe through to it natively. A
 * `pausedRef` + `waitWhilePaused()` guards the gaps between animations
 * (e.g. when the sequence is paused during narration). Browser
 * speechSynthesis natively supports pause/resume.
 */
export function useGuidedPlayer({
  payload,
  containerRef,
}: UseGuidedPlayerArgs): UseGuidedPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [narrationText, setNarrationText] = useState(payload.narrationBox.placeholder)
  const sequenceRef = useRef(0)

  // Pause primitives — resolver is replaced with a new pending promise on pause,
  // and called/cleared on resume so awaiting ops continue.
  const pausedRef = useRef(false)
  const pauseResolverRef = useRef<(() => void) | null>(null)
  const activeAnimationRef = useRef<PausableAnimation | null>(null)

  useEffect(() => {
    primeSpeechVoices()
    return () => {
      cancelSpeech()
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
    setNarrationText(payload.narrationBox.placeholder)
    if (containerRef.current) resetScene(containerRef.current)
  }, [payload.narrationBox.placeholder, containerRef])

  const pause = useCallback(() => {
    if (!isPlaying || pausedRef.current) return
    pausedRef.current = true
    setIsPaused(true)
    activeAnimationRef.current?.pause()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause()
    }
  }, [isPlaying])

  const resume = useCallback(() => {
    if (!pausedRef.current) return
    pausedRef.current = false
    setIsPaused(false)
    activeAnimationRef.current?.play()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume()
    }
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
        for (const step of payload.steps) {
          if (shouldCancel()) return
          await waitWhilePaused()
          if (shouldCancel()) return
          await runStep(step, {
            root,
            locale: payload.locale,
            shouldCancel,
            waitWhilePaused,
            registerAnimation,
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
  }, [isPlaying, payload.steps, payload.locale, containerRef, waitWhilePaused, registerAnimation])

  return { isPlaying, isPaused, narrationText, play, pause, resume, reset }
}

// ---------------------------------------------------------------------------

interface RunStepCtx {
  root: HTMLElement
  locale: string
  shouldCancel: () => boolean
  waitWhilePaused: () => Promise<void>
  registerAnimation: (anim: PausableAnimation | null) => void
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
    })
  }
  if (step.narrate && !ctx.shouldCancel()) {
    await ctx.waitWhilePaused()
    if (ctx.shouldCancel()) return
    const display = stripNiqqud(step.narrate.display)
    ctx.setNarrationText(display)
    const toSpeak = step.narrate.speech ?? step.narrate.display
    await speak(toSpeak, ctx.locale)
  }
  if (step.wait && !ctx.shouldCancel()) {
    await ctx.waitWhilePaused()
    if (!ctx.shouldCancel()) await new Promise((r) => setTimeout(r, step.wait))
  }
}
