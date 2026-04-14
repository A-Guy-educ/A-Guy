'use client'

import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useMemo, useRef } from 'react'
import type { GuidedExplanationV2 } from '@/infra/contracts/guided-explanation/v2'
import { assignIds, renderDrawingOp, SVG_DEFS } from './primitives'
import { useV2Player } from './useV2Player'
import './v2.css'

interface Props {
  payload: GuidedExplanationV2
}

/**
 * Primitives-based renderer. Gemini sends a list of drawing + timeline
 * ops; we validate via Zod and execute from a trusted runtime. No
 * untrusted scripts run — every op is a closed enum member.
 */
export function GuidedExplanationRunnerV2({ payload }: Props) {
  const sceneRef = useRef<HTMLElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const { isPlaying, narrationText, play, reset } = useV2Player({ payload, sceneRef })

  // Auto-assign ids to drawing ops without one (so timeline ops can reference them).
  const opsWithIds = useMemo(() => assignIds(payload.ops), [payload.ops])

  // Build the initial SVG from all drawing ops.
  const sceneSvg = useMemo(() => {
    const fragments: string[] = []
    fragments.push(SVG_DEFS)
    for (const op of opsWithIds) {
      const result = renderDrawingOp(op)
      if (result) fragments.push(result.svg)
    }
    return fragments.join('\n')
  }, [opsWithIds])

  // Imperatively set the SVG innerHTML (avoids React re-rendering and
  // wiping dynamically added animation classes). Also renders any
  // <foreignObject data-latex="..."> placeholders via KaTeX.
  useEffect(() => {
    if (!svgRef.current) return
    svgRef.current.innerHTML = sceneSvg
    // Render KaTeX equations
    svgRef.current.querySelectorAll('[data-latex]').forEach((el) => {
      const latex = el.getAttribute('data-latex') ?? ''
      try {
        katex.render(latex, el as HTMLElement, { throwOnError: false, output: 'html' })
      } catch {
        ;(el as HTMLElement).textContent = latex
      }
    })
  }, [sceneSvg])

  return (
    <section
      ref={sceneRef as React.RefObject<HTMLElement>}
      className="guided-explanation-v2"
      dir={payload.direction}
      lang={payload.locale}
    >
      <header className="ge2-header">
        <h1 className="ge2-title">{payload.title}</h1>
        {payload.subtitle ? <p className="ge2-subtitle">{payload.subtitle}</p> : null}
      </header>

      <div className="ge2-scene">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${payload.canvas.width} ${payload.canvas.height}`}
          xmlns="http://www.w3.org/2000/svg"
        />
      </div>

      <div className="ge2-controls">
        <button
          type="button"
          className="ge2-btn ge2-btn-primary"
          onClick={play}
          disabled={isPlaying}
        >
          {payload.controls.playLabel}
        </button>
        <button type="button" className="ge2-btn ge2-btn-secondary" onClick={reset}>
          {payload.controls.resetLabel}
        </button>
      </div>

      <div className="ge2-narration-box">
        <span className="ge2-narration-text">{narrationText}</span>
      </div>
    </section>
  )
}
