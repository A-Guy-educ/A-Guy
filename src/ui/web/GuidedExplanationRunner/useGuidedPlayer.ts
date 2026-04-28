'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GuidedExplanationStep,
  GuidedExplanationV1,
} from '@/infra/contracts/guided-explanation/v1'
import {
  ASK_STEP_CONTEXT_EVENT,
  type AskStepContextEvent,
} from '@/app/(frontend)/ask/_components/ask-types'
import { runAction, resetScene, type PausableAnimation } from './sceneActions'
import { cancelSpeech, primeSpeechVoices, startSpeech, stripNiqqud } from './speech'

function emitStepContext(detail: AskStepContextEvent | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ASK_STEP_CONTEXT_EVENT, { detail }))
}

interface UseGuidedPlayerArgs {
  payload: GuidedExplanationV1
  containerRef: React.MutableRefObject<HTMLElement | null>
}

interface UseGuidedPlayerResult {
  isPlaying: boolean
  isPaused: boolean
  isComplete: boolean
  soundOn: boolean
  narrationText: string
  currentStep: number
  totalSteps: number
  speed: number
  play: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setSpeed: (rate: number) => void
  toggleSound: () => void
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
  const [isComplete, setIsComplete] = useState(false)
  const [narrationText, setNarrationText] = useState(payload.narrationBox.placeholder)
  const [currentStep, setCurrentStep] = useState(0)
  const [speed, setSpeedState] = useState(1)
  const [soundOn, setSoundOnState] = useState(true)
  const sequenceRef = useRef(0)
  const speedRef = useRef(1)
  const soundOnRef = useRef(true)
  // Mirror of `isPlaying` for synchronous reads. The replay path (reset →
  // play in the same tick) needs an immediate value; the React state is
  // still queued and the play() closure would read the stale "true" from
  // before reset, no-op'ing the guard. The ref is updated wherever
  // isPlaying state is updated.
  const isPlayingRef = useRef(false)

  // Pause primitives — resolver is replaced with a new pending promise on pause,
  // and called/cleared on resume so awaiting ops continue.
  const pausedRef = useRef(false)
  const pauseResolverRef = useRef<(() => void) | null>(null)
  const activeAnimationRef = useRef<PausableAnimation | null>(null)

  const totalSteps = payload.steps.length

  useEffect(() => {
    primeSpeechVoices()
    return () => {
      // Cancel the active animation/audio handle FIRST. With cached cloud
      // TTS now the common path, the live HTMLAudioElement is held inside
      // activeAnimationRef — without this the audio keeps playing after
      // the component unmounts (e.g. user clicks "Back to exercise"
      // mid-step). cancelSpeech() only addresses the browser-fallback
      // speechSynthesis case.
      sequenceRef.current += 1
      activeAnimationRef.current?.cancel?.()
      activeAnimationRef.current = null
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

  /**
   * Toggle audio on/off. Flips soundOnRef synchronously so the next step's
   * startSpeech() call sees the new mode; the in-flight step's audio (or
   * muted timer) is left alone and finishes naturally. Switching mid-step
   * would cut audio off abruptly or jolt the muted-timer duration, so the
   * "takes effect on the next step" semantics is the deliberate behavior.
   */
  const toggleSound = useCallback(() => {
    soundOnRef.current = !soundOnRef.current
    setSoundOnState(soundOnRef.current)
  }, [])

  const isMutedForSpeech = useCallback(() => !soundOnRef.current, [])

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
    isPlayingRef.current = false
    setIsPlaying(false)
    setIsPaused(false)
    setIsComplete(false)
    setCurrentStep(0)
    setNarrationText(payload.narrationBox.placeholder)
    if (containerRef.current) resetScene(containerRef.current)
    emitStepContext(null)
  }, [payload.narrationBox.placeholder, containerRef])

  const pause = useCallback(() => {
    if (!isPlayingRef.current || pausedRef.current) return
    pausedRef.current = true
    setIsPaused(true)
    activeAnimationRef.current?.pause()
  }, [])

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
    // Read from the ref so a synchronous reset()→play() (the Replay path)
    // sees the just-cleared value, not the stale "true" from a closure
    // bound to the previous render.
    if (isPlayingRef.current) return
    const root = containerRef.current
    if (!root) return

    sequenceRef.current += 1
    const mySequence = sequenceRef.current
    const shouldCancel = () => sequenceRef.current !== mySequence

    isPlayingRef.current = true
    setIsPlaying(true)
    setIsPaused(false)
    setIsComplete(false)
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
            isMuted: isMutedForSpeech,
            isPaused: () => pausedRef.current,
            setNarrationText,
          })
        }
      } finally {
        if (!shouldCancel()) {
          isPlayingRef.current = false
          setIsPlaying(false)
          setIsPaused(false)
          setIsComplete(true)
          pausedRef.current = false
          activeAnimationRef.current = null
        }
      }
    })()
  }, [
    payload.steps,
    payload.locale,
    totalSteps,
    containerRef,
    waitWhilePaused,
    registerAnimation,
    getSpeed,
    isMutedForSpeech,
  ])

  return {
    isPlaying,
    isPaused,
    isComplete,
    soundOn,
    narrationText,
    currentStep,
    totalSteps,
    speed,
    play,
    pause,
    resume,
    reset,
    setSpeed,
    toggleSound,
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
  isMuted: () => boolean
  /** Read pausedRef directly so callers can honor it across async boundaries. */
  isPaused: () => boolean
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
    const handle = await startSpeech(toSpeak, ctx.locale, ctx.getSpeed(), {
      muted: ctx.isMuted(),
      audioBase64: step.narrate.audioBase64 ?? null,
    })
    // The await above can take seconds on the no-cache path (a live
    // /api/tts/synthesize fetch). If the user clicked Back-to-exercise or
    // unmounted in that window, the handle is registered AFTER the cancel
    // already fired, so audio starts playing into a torn-down player.
    // Cancel the handle immediately and bail out instead.
    if (ctx.shouldCancel()) {
      handle.cancel()
      return
    }
    // If the user clicked Pause during the fetch, activeAnimationRef was
    // empty so pause() couldn't reach into it — pausedRef was set but the
    // audio would otherwise start playing the moment startSpeech resolves
    // and ignore the paused state until the next action boundary. Honor
    // the paused flag now that we have a real handle.
    if (ctx.isPaused()) handle.pause()
    ctx.registerAnimation(handle)
    await handle.finished
    ctx.registerAnimation(null)
  }
  if (step.wait && !ctx.shouldCancel()) {
    await ctx.waitWhilePaused()
    if (!ctx.shouldCancel()) await new Promise((r) => setTimeout(r, step.wait))
  }
}
