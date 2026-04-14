/**
 * Timeline executor for GuidedExplanationV2.
 *
 * Two phases:
 *   1. Setup — all drawing ops run synchronously at mount time, creating
 *      SVG elements that start hidden (opacity 0 or stroke-dashoffset).
 *   2. Playback — timeline ops (show/draw/narrate/wait/highlight) run
 *      sequentially when the user presses Play.
 *
 * All DOM queries are scoped to the scene root ref. Cancellation via
 * a monotonic sequence counter checked between ops.
 */
import type { GuidedExplanationOp } from '@/infra/contracts/guided-explanation/v2'
import { cancelSpeech, speak, stripNiqqud } from '../speech'

const VISIBLE_CLASS = 'ge2-visible'
const DRAWN_CLASS = 'ge2-drawn'
const HIGHLIGHT_CLASS = 'ge2-highlighted'

export interface TimelineContext {
  root: HTMLElement
  locale: string
  shouldCancel: () => boolean
  setNarration: (text: string) => void
}

function escapeId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id)
  return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

function findEl(root: HTMLElement, id: string): HTMLElement | null {
  return root.querySelector(`#${escapeId(id)}`) as HTMLElement | null
}

/** Run a single timeline op. Drawing ops are no-ops here (they ran at setup). */
async function runOp(op: GuidedExplanationOp, ctx: TimelineContext): Promise<void> {
  if (ctx.shouldCancel()) return

  switch (op.op) {
    // Drawing ops are setup-time — skip during playback
    case 'line':
    case 'circle':
    case 'rect':
    case 'polygon':
    case 'arrow':
    case 'path':
    case 'text':
    case 'equation':
    case 'point':
      return

    case 'show': {
      const el = findEl(ctx.root, op.id)
      if (!el) return
      el.classList.add(VISIBLE_CLASS)
      el.classList.add(DRAWN_CLASS)
      return
    }
    case 'hide': {
      const el = findEl(ctx.root, op.id)
      if (!el) return
      el.classList.remove(VISIBLE_CLASS)
      el.classList.remove(DRAWN_CLASS)
      return
    }
    case 'drawAnimated': {
      const el = findEl(ctx.root, op.id)
      if (!el) return
      el.classList.add(DRAWN_CLASS)
      el.classList.add(VISIBLE_CLASS)
      const duration = op.durationMs ?? 1000
      await new Promise((r) => setTimeout(r, duration))
      return
    }
    case 'highlight': {
      const el = findEl(ctx.root, op.id)
      if (!el) return
      const duration = op.durationMs ?? 1500
      el.classList.add(HIGHLIGHT_CLASS)
      setTimeout(() => {
        if (!ctx.shouldCancel()) el.classList.remove(HIGHLIGHT_CLASS)
      }, duration)
      return
    }
    case 'wait': {
      await new Promise((r) => setTimeout(r, op.ms))
      return
    }
    case 'narrate': {
      ctx.setNarration(stripNiqqud(op.display))
      const toSpeak = op.speech ?? op.display
      await speak(toSpeak, ctx.locale)
      return
    }
    default: {
      const _exhaustive: never = op
      void _exhaustive
      return
    }
  }
}

/** Run the full op list sequentially, honoring cancellation. */
export async function runTimeline(ops: GuidedExplanationOp[], ctx: TimelineContext): Promise<void> {
  for (const op of ops) {
    if (ctx.shouldCancel()) return
    await runOp(op, ctx)
  }
}

/** Remove all runtime-added classes from the scene. */
export function resetScene(root: HTMLElement): void {
  root.querySelectorAll(`.${VISIBLE_CLASS}`).forEach((el) => el.classList.remove(VISIBLE_CLASS))
  root.querySelectorAll(`.${DRAWN_CLASS}`).forEach((el) => el.classList.remove(DRAWN_CLASS))
  root.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.classList.remove(HIGHLIGHT_CLASS))
  cancelSpeech()
}
