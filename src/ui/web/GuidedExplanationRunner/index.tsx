'use client'

import { useMemo, useRef } from 'react'
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
 * The scene SVG is passed through the shared SVG sanitizer before render,
 * which strips <script>, event handlers, foreignObject and external refs.
 */
export function GuidedExplanationRunner({ payload }: GuidedExplanationRunnerProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const { isPlaying, narrationText, play, reset } = useGuidedPlayer({
    payload,
    containerRef: rootRef,
  })

  const sanitizedSvg = useMemo(() => sanitizeSvg(payload.scene.svg), [payload.scene.svg])

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

      <div className="ge-scene" dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />

      <Controls
        playLabel={payload.controls.playLabel}
        resetLabel={payload.controls.resetLabel}
        isPlaying={isPlaying}
        onPlay={play}
        onReset={reset}
      />

      {payload.proofTable ? <ProofTable table={payload.proofTable} /> : null}

      <NarrationBox text={narrationText} />
    </section>
  )
}
