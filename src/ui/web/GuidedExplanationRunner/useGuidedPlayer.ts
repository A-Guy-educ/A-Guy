'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GuidedExplanationStep,
  GuidedExplanationV1,
} from '@/infra/contracts/guided-explanation/v1'
import { runAction, resetScene } from './sceneActions'
import { cancelSpeech, primeSpeechVoices, speak, stripNiqqud } from './speech'

interface UseGuidedPlayerArgs {
  payload: GuidedExplanationV1
  containerRef: React.MutableRefObject<HTMLElement | null>
}

interface UseGuidedPlayerResult {
  isPlaying: boolean
  narrationText: string
  play: () => void
  reset: () => void
}

/**
 * State machine driving the guided explanation sequence.
 *
 * Cancellation model mirrors the reference HTML: a monotonic counter
 * (`sequenceRef`) is captured in closure at play-start; any in-flight
 * async work compares against the live counter via `shouldCancel()` and
 * bails out the moment the counter changes (i.e. reset or replay).
 */
export function useGuidedPlayer({
  payload,
  containerRef,
}: UseGuidedPlayerArgs): UseGuidedPlayerResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [narrationText, setNarrationText] = useState(payload.narrationBox.placeholder)
  const sequenceRef = useRef(0)

  useEffect(() => {
    primeSpeechVoices()
    return () => {
      cancelSpeech()
    }
  }, [])

  const reset = useCallback(() => {
    sequenceRef.current += 1
    cancelSpeech()
    setIsPlaying(false)
    setNarrationText(payload.narrationBox.placeholder)
    if (containerRef.current) resetScene(containerRef.current)
  }, [payload.narrationBox.placeholder, containerRef])

  const play = useCallback(() => {
    if (isPlaying) return
    const root = containerRef.current
    if (!root) return

    sequenceRef.current += 1
    const mySequence = sequenceRef.current
    const shouldCancel = () => sequenceRef.current !== mySequence

    setIsPlaying(true)

    void (async () => {
      try {
        for (const step of payload.steps) {
          if (shouldCancel()) return
          await runStep(step, { root, locale: payload.locale, shouldCancel, setNarrationText })
        }
      } finally {
        if (!shouldCancel()) setIsPlaying(false)
      }
    })()
  }, [isPlaying, payload.steps, payload.locale, containerRef])

  return { isPlaying, narrationText, play, reset }
}

// ---------------------------------------------------------------------------

interface RunStepCtx {
  root: HTMLElement
  locale: string
  shouldCancel: () => boolean
  setNarrationText: (text: string) => void
}

async function runStep(step: GuidedExplanationStep, ctx: RunStepCtx): Promise<void> {
  for (const action of step.actions) {
    if (ctx.shouldCancel()) return
    await runAction(action, { root: ctx.root, shouldCancel: ctx.shouldCancel })
  }
  if (step.narrate && !ctx.shouldCancel()) {
    const display = stripNiqqud(step.narrate.display)
    ctx.setNarrationText(display)
    const toSpeak = step.narrate.speech ?? step.narrate.display
    await speak(toSpeak, ctx.locale, ctx.shouldCancel)
  }
  if (step.wait && !ctx.shouldCancel()) {
    await new Promise((r) => setTimeout(r, step.wait))
  }
}
