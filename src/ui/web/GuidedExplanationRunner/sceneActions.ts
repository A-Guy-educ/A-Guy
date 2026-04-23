/**
 * Scene action executor for GuidedExplanationRunner.
 *
 * Every action is applied via a **scoped** querySelector from the component's
 * root element — never `document.*`. A malformed or adversarial payload
 * cannot reach into the surrounding page: at worst it fails to find its
 * target and logs a warning.
 *
 * Animation driver: Anime.js v4. Each action returns a Promise that resolves
 * when its animation finishes. The runner registers the in-flight animation
 * with the player so pause/resume can control it natively.
 */
import { animate } from 'animejs'
import type { GuidedExplanationAction } from '@/infra/contracts/guided-explanation/v1'

const DRAW_DURATION_MS = 1500
const DRAW_DURATION_FAST_MS = 800
const FADE_DURATION_MS = 500
const DEFAULT_ROW_HIGHLIGHT_MS = 2000
const DRAW_FAST_CLASS = 'ge-draw-path-fast'
const ROW_ACTIVE_CLASS = 'ge-row-active'
const ROW_REVEALED_CLASS = 'ge-row-revealed'

/** Minimal surface we need from an anime.js animation for pause/resume. */
export interface PausableAnimation {
  pause: () => void
  play: () => void
  cancel?: () => void
  /** Apply a new playback rate live (1 = normal, 2 = double-speed, etc.). */
  setRate?: (rate: number) => void
}

export interface ActionContext {
  root: HTMLElement
  /** Called when the caller has been cancelled — long-running actions bail. */
  shouldCancel: () => boolean
  /** Register the currently-running animation so the player can pause/resume it. */
  registerAnimation: (anim: PausableAnimation | null) => void
  /** Current playback speed (1 = normal). Read at animation-creation time. */
  getSpeed: () => number
}

/**
 * Wrap an anime.js animation as a PausableAnimation. Uses the library's
 * `speed` property for live rate control (v4 exposes this on every instance).
 */
function wrapAnime(anim: unknown): PausableAnimation {
  const a = anim as {
    pause: () => void
    play: () => void
    cancel?: () => void
    speed?: number
  }
  return {
    pause: () => a.pause(),
    play: () => a.play(),
    cancel: () => a.cancel?.(),
    setRate: (rate: number) => {
      a.speed = rate
    },
  }
}

/**
 * Escape an id for safe use inside a CSS selector. Author ids arrive from
 * the payload and could contain characters that break `#...` selectors.
 */
function escapeId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id)
  return id.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

function findElement(root: HTMLElement, id: string): HTMLElement | null {
  const el = root.querySelector(`#${escapeId(id)}`)
  if (!el) return null
  return el as HTMLElement
}

function startAnime(anim: unknown, ctx: ActionContext): PausableAnimation {
  const wrapped = wrapAnime(anim)
  wrapped.setRate?.(ctx.getSpeed())
  ctx.registerAnimation(wrapped)
  return wrapped
}

/** Animate a draw-in using stroke-dashoffset, sized to the path's real length. */
async function animateDraw(el: HTMLElement, ctx: ActionContext, reverse: boolean): Promise<void> {
  const geo = el as unknown as SVGGeometryElement
  const length = typeof geo.getTotalLength === 'function' ? geo.getTotalLength() : 1000
  el.style.strokeDasharray = String(length)
  const duration = el.classList.contains(DRAW_FAST_CLASS) ? DRAW_DURATION_FAST_MS : DRAW_DURATION_MS
  const from = reverse ? 0 : length
  const to = reverse ? length : 0
  el.style.strokeDashoffset = String(from)
  const anim = animate(el, {
    strokeDashoffset: [from, to],
    duration,
    ease: 'inOutQuad',
  })
  startAnime(anim, ctx)
  await (anim as unknown as Promise<unknown>)
  ctx.registerAnimation(null)
}

/** Animate an opacity fade. */
async function animateFade(el: HTMLElement, ctx: ActionContext, toVisible: boolean): Promise<void> {
  const from = toVisible ? 0 : 1
  const to = toVisible ? 1 : 0
  el.style.opacity = String(from)
  const anim = animate(el, {
    opacity: [from, to],
    duration: FADE_DURATION_MS,
    ease: 'inOutQuad',
  })
  startAnime(anim, ctx)
  await (anim as unknown as Promise<unknown>)
  ctx.registerAnimation(null)
}

/** Pauseable wait — runs a dummy tween so pause/resume/speed work during delays. */
async function animateWait(ms: number, ctx: ActionContext): Promise<void> {
  const anim = animate(
    { t: 0 },
    {
      t: 1,
      duration: ms,
      ease: 'linear',
    },
  )
  startAnime(anim, ctx)
  await (anim as unknown as Promise<unknown>)
  ctx.registerAnimation(null)
}

export async function runAction(
  action: GuidedExplanationAction,
  ctx: ActionContext,
): Promise<void> {
  if (ctx.shouldCancel()) return
  switch (action.op) {
    case 'show': {
      const el = findElement(ctx.root, action.id)
      if (!el) return
      await animateFade(el, ctx, true)
      return
    }
    case 'hide': {
      const el = findElement(ctx.root, action.id)
      if (!el) return
      await animateFade(el, ctx, false)
      return
    }
    case 'draw': {
      const el = findElement(ctx.root, action.id)
      if (!el) return
      await animateDraw(el, ctx, false)
      return
    }
    case 'undraw': {
      const el = findElement(ctx.root, action.id)
      if (!el) return
      await animateDraw(el, ctx, true)
      return
    }
    case 'highlightRow': {
      const row = findElement(ctx.root, action.rowId)
      if (!row) return
      row.classList.add(ROW_REVEALED_CLASS)
      row.classList.add(ROW_ACTIVE_CLASS)
      const duration = action.durationMs ?? DEFAULT_ROW_HIGHLIGHT_MS
      await animateWait(duration, ctx)
      if (!ctx.shouldCancel()) row.classList.remove(ROW_ACTIVE_CLASS)
      return
    }
    case 'setText': {
      const el = findElement(ctx.root, action.id)
      // textContent is HTML-safe by construction: no markup is interpreted.
      if (el) el.textContent = action.text
      return
    }
    case 'wait': {
      await animateWait(action.ms, ctx)
      return
    }
    default: {
      // Exhaustiveness check — TypeScript will flag if a new op is added
      // to the contract without a case here.
      const _exhaustive: never = action
      void _exhaustive
      return
    }
  }
}

/** Remove all engine-managed state from the scene. Used on reset. */
export function resetScene(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.ge-draw-path, .ge-draw-path-fast').forEach((el) => {
    el.style.strokeDasharray = ''
    el.style.strokeDashoffset = ''
  })
  root.querySelectorAll<HTMLElement>('.ge-fade-element').forEach((el) => {
    el.style.opacity = ''
  })
  root
    .querySelectorAll(`.${ROW_ACTIVE_CLASS}`)
    .forEach((el) => el.classList.remove(ROW_ACTIVE_CLASS))
  root
    .querySelectorAll(`.${ROW_REVEALED_CLASS}`)
    .forEach((el) => el.classList.remove(ROW_REVEALED_CLASS))
}
