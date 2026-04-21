/**
 * Scene action executor for GuidedExplanationRunner.
 *
 * Every action is applied via a **scoped** querySelector from the component's
 * root element — never `document.*`. A malformed or adversarial payload
 * cannot reach into the surrounding page: at worst it fails to find its
 * target and logs a warning.
 */
import type { GuidedExplanationAction } from '@/infra/contracts/guided-explanation/v1'

const VISIBLE_CLASS = 'ge-visible'
const DRAWN_CLASS = 'ge-drawn'
const ROW_ACTIVE_CLASS = 'ge-row-active'
const ROW_REVEALED_CLASS = 'ge-row-revealed'
const DEFAULT_ROW_HIGHLIGHT_MS = 2000

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

export interface ActionContext {
  root: HTMLElement
  /** Called when the caller has been cancelled — long-running actions bail. */
  shouldCancel: () => boolean
}

export async function runAction(
  action: GuidedExplanationAction,
  ctx: ActionContext,
): Promise<void> {
  if (ctx.shouldCancel()) return
  switch (action.op) {
    case 'show': {
      findElement(ctx.root, action.id)?.classList.add(VISIBLE_CLASS)
      return
    }
    case 'hide': {
      findElement(ctx.root, action.id)?.classList.remove(VISIBLE_CLASS)
      return
    }
    case 'draw': {
      findElement(ctx.root, action.id)?.classList.add(DRAWN_CLASS)
      return
    }
    case 'undraw': {
      findElement(ctx.root, action.id)?.classList.remove(DRAWN_CLASS)
      return
    }
    case 'highlightRow': {
      const row = findElement(ctx.root, action.rowId)
      if (!row) return
      // Permanently reveal the row (opacity 1) and apply a temporary
      // yellow flash so the student's eye lands on it.
      row.classList.add(ROW_REVEALED_CLASS)
      row.classList.add(ROW_ACTIVE_CLASS)
      const duration = action.durationMs ?? DEFAULT_ROW_HIGHLIGHT_MS
      setTimeout(() => {
        if (!ctx.shouldCancel()) row.classList.remove(ROW_ACTIVE_CLASS)
      }, duration)
      return
    }
    case 'setText': {
      const el = findElement(ctx.root, action.id)
      // textContent is HTML-safe by construction: no markup is interpreted.
      if (el) el.textContent = action.text
      return
    }
    case 'wait': {
      await new Promise((r) => setTimeout(r, action.ms))
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

/** Remove all engine-managed classes from the scene. Used on reset. */
export function resetScene(root: HTMLElement): void {
  root.querySelectorAll(`.${VISIBLE_CLASS}`).forEach((el) => el.classList.remove(VISIBLE_CLASS))
  root.querySelectorAll(`.${DRAWN_CLASS}`).forEach((el) => el.classList.remove(DRAWN_CLASS))
  root
    .querySelectorAll(`.${ROW_ACTIVE_CLASS}`)
    .forEach((el) => el.classList.remove(ROW_ACTIVE_CLASS))
  root
    .querySelectorAll(`.${ROW_REVEALED_CLASS}`)
    .forEach((el) => el.classList.remove(ROW_REVEALED_CLASS))
}
