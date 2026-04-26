'use client'

import { useCallback, useEffect, useRef } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import type { GuidedExplanationV1 } from '@/infra/contracts/guided-explanation/v1'
import { sanitizeSvg } from '@/ui/web/exerciserenderer/utils/svgSanitize'
import { cn } from '@/infra/utils/ui'
import { Controls } from './Controls'
import { NarrationBox } from './NarrationBox'
import { ProofTable } from './ProofTable'
import { useGuidedPlayer } from './useGuidedPlayer'
import './guided-explanation.css'

interface GuidedExplanationRunnerProps {
  payload: GuidedExplanationV1
}

/**
 * Trusted renderer for AI-generated guided explanations.
 *
 * The runner receives a `GuidedExplanationV1` payload (data only — no code)
 * and drives the animation + narration sequence itself. All DOM queries are
 * scoped to `rootRef.current`, so a malformed payload cannot reach into
 * the surrounding page.
 *
 * The scene SVG comes from our own converter/validator — not raw user input
 * — so we skip DOMPurify and set it via a ref to prevent React re-renders
 * from wiping dynamically added animation classes.
 */
export function GuidedExplanationRunner({ payload }: GuidedExplanationRunnerProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const {
    isPlaying,
    isPaused,
    isComplete,
    narrationText,
    currentStep,
    totalSteps,
    speed,
    play,
    pause,
    resume,
    reset,
    setSpeed,
  } = useGuidedPlayer({
    payload,
    containerRef: rootRef,
  })

  const isHebrew = payload.locale === 'he'
  // Default labels for languages not supplied by the payload — Hebrew and
  // English cover both locales the app currently supports.
  const pauseLabel = payload.controls.pauseLabel ?? (isHebrew ? 'השהיה' : 'Pause')
  const resumeLabel = payload.controls.resumeLabel ?? (isHebrew ? 'המשך' : 'Resume')
  const speedLabel = isHebrew ? 'מהירות' : 'Speed'
  const completeLabel = isHebrew ? 'הכל טוב! ✓' : 'Solved ✓'
  const replayLabel = isHebrew ? 'חזרה מהתחלה' : 'Replay'
  const playAriaLabel = isHebrew ? 'התחל הסבר' : 'Start explanation'

  const currentStepTitle = currentStep > 0 ? (payload.steps[currentStep - 1]?.title ?? null) : null

  const handleReplay = useCallback(() => {
    reset()
    // Let reset's state updates flush before the next play kicks off, so
    // play() reads a clean isPlaying/currentStep closure instead of the
    // stale "just finished" one.
    setTimeout(() => play(), 0)
  }, [reset, play])

  // Sanitize SVG at render time (strips <script>, event handlers,
  // foreignObject, external refs) then set via ref so React never
  // re-renders the scene div and wipes dynamically added animation
  // classes (ge-drawn, ge-visible, ge-row-active, etc.).
  useEffect(() => {
    if (sceneRef.current && payload.scene.svg) {
      sceneRef.current.innerHTML = sanitizeSvg(payload.scene.svg)
    }
  }, [payload.scene.svg])

  const showPlayOverlay = !isPlaying && !isComplete && currentStep === 0
  const showStepCard = isPlaying && currentStep > 0 && !!currentStepTitle

  return (
    <section
      ref={rootRef}
      className="guided-explanation"
      dir={payload.direction}
      lang={payload.locale}
    >
      <header className="ge-header">
        <h1 className="ge-title">{payload.title}</h1>
        {payload.subtitle ? <p className="ge-subtitle">{payload.subtitle}</p> : null}
      </header>

      <div className="ge-scene" role="img" aria-label={payload.title}>
        <div ref={sceneRef} className="ge-scene-inner" />

        {showPlayOverlay && (
          <button
            type="button"
            className="ge-play-overlay"
            onClick={play}
            aria-label={playAriaLabel}
          >
            <Play className="ge-play-overlay-icon" fill="currentColor" />
          </button>
        )}

        {showStepCard && (
          <div className="ge-step-card" aria-live="polite">
            <span className="ge-step-card-number">{currentStep}</span>
            <span className="ge-step-card-title">{currentStepTitle}</span>
            <span className="ge-step-card-total">/ {totalSteps}</span>
          </div>
        )}

        {isComplete && (
          <div className="ge-completion-card" role="status">
            <div className="ge-completion-checkmark">✓</div>
            <h2 className="ge-completion-title">{completeLabel}</h2>
            <p className="ge-completion-subtitle">{payload.title}</p>
            <button
              type="button"
              className="ge-btn ge-btn-primary ge-completion-replay"
              onClick={handleReplay}
            >
              <RotateCcw className="w-4 h-4" />
              {replayLabel}
            </button>
          </div>
        )}
      </div>

      <div className="ge-progress" aria-hidden="true">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'ge-progress-step',
              i < currentStep && 'ge-progress-step-done',
              i === currentStep - 1 && isPlaying && 'ge-progress-step-active',
            )}
          />
        ))}
      </div>

      <Controls
        playLabel={payload.controls.playLabel}
        resetLabel={payload.controls.resetLabel}
        pauseLabel={pauseLabel}
        resumeLabel={resumeLabel}
        speedLabel={speedLabel}
        isPlaying={isPlaying}
        isPaused={isPaused}
        speed={speed}
        onPlay={play}
        onPause={pause}
        onResume={resume}
        onReset={reset}
        onSpeedChange={setSpeed}
      />

      <NarrationBox text={narrationText} />

      {payload.proofTable ? <ProofTable table={payload.proofTable} /> : null}
    </section>
  )
}
