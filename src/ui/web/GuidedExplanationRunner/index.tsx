'use client'

import { useEffect, useRef } from 'react'
import type { GuidedExplanationV1 } from '@/infra/contracts/guided-explanation/v1'
import { sanitizeSvg } from '@/ui/web/exerciserenderer/utils/svgSanitize'
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
  const stepLabel =
    currentStep > 0
      ? isHebrew
        ? `שלב ${currentStep} מתוך ${totalSteps}`
        : `Step ${currentStep} of ${totalSteps}`
      : null

  // Sanitize SVG at render time (strips <script>, event handlers,
  // foreignObject, external refs) then set via ref so React never
  // re-renders the scene div and wipes dynamically added animation
  // classes (ge-drawn, ge-visible, ge-row-active, etc.).
  useEffect(() => {
    if (sceneRef.current && payload.scene.svg) {
      sceneRef.current.innerHTML = sanitizeSvg(payload.scene.svg)
    }
  }, [payload.scene.svg])

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
        {stepLabel ? <p className="ge-step-indicator">{stepLabel}</p> : null}
      </header>

      <div ref={sceneRef} className="ge-scene" />

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

      {payload.proofTable ? <ProofTable table={payload.proofTable} /> : null}

      <NarrationBox text={narrationText} />
    </section>
  )
}
