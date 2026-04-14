/**
 * SVG element builders for each drawing op in GuidedExplanationV2.
 *
 * Every function takes a validated op (Zod already ran) and returns an
 * SVG element string. All user-supplied values are escaped. Unknown
 * colors fall back to a safe default. No innerHTML from user strings —
 * text content is always inside a text node.
 */
import type { GuidedExplanationOp } from '@/infra/contracts/guided-explanation/v2'

const COLOR_MAP: Record<string, string> = {
  blue: '#2563eb',
  red: '#ef4444',
  green: '#10b981',
  orange: '#f59e0b',
  purple: '#8b5cf6',
  yellow: '#eab308',
  black: '#111827',
  gray: '#6b7280',
}

function resolveColor(color: string | undefined, fallback = '#2563eb'): string {
  if (!color) return fallback
  if (COLOR_MAP[color]) return COLOR_MAP[color]
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color
  return fallback
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------------------------------------------------------------------------
// ID assignment — drawing ops without an id get auto-assigned one
// ---------------------------------------------------------------------------

export function assignIds(ops: GuidedExplanationOp[]): GuidedExplanationOp[] {
  let counter = 0
  return ops.map((op) => {
    if ('id' in op && op.id) return op
    if (isDrawingOp(op)) {
      counter += 1
      return { ...op, id: `auto-${counter}` } as GuidedExplanationOp
    }
    return op
  })
}

const DRAWING_OPS = new Set([
  'line',
  'circle',
  'rect',
  'polygon',
  'arrow',
  'path',
  'text',
  'equation',
  'point',
])

function isDrawingOp(op: GuidedExplanationOp): boolean {
  return DRAWING_OPS.has(op.op)
}

// ---------------------------------------------------------------------------
// Individual op renderers
// ---------------------------------------------------------------------------

interface DrawResult {
  /** The SVG fragment to append to the scene. */
  svg: string
  /** Animation type — determines how `drawAnimated` and `show` behave. */
  animationClass: 'path' | 'fade'
}

export function renderDrawingOp(op: GuidedExplanationOp): DrawResult | null {
  const id = 'id' in op ? op.id : undefined
  if (!id) return null

  switch (op.op) {
    case 'line': {
      const color = resolveColor(op.color)
      const sw = op.strokeWidth ?? 3
      const dash = op.dashed ? ' stroke-dasharray="8 4"' : ''
      return {
        svg: `<line id="${id}" class="ge2-path" x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"${dash} fill="none"/>`,
        animationClass: 'path',
      }
    }
    case 'arrow': {
      const color = resolveColor(op.color)
      const sw = op.strokeWidth ?? 3
      return {
        svg: `<line id="${id}" class="ge2-path" x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" marker-end="url(#ge2-arrow)" fill="none"/>`,
        animationClass: 'path',
      }
    }
    case 'circle': {
      const stroke = resolveColor(op.stroke)
      const fill = op.fill ? resolveColor(op.fill) : 'none'
      const sw = op.strokeWidth ?? 2
      return {
        svg: `<circle id="${id}" class="ge2-fade" cx="${op.cx}" cy="${op.cy}" r="${op.r}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}"/>`,
        animationClass: 'fade',
      }
    }
    case 'rect': {
      const stroke = resolveColor(op.stroke)
      const fill = op.fill ? resolveColor(op.fill) : 'none'
      const sw = op.strokeWidth ?? 2
      return {
        svg: `<rect id="${id}" class="ge2-fade" x="${op.x}" y="${op.y}" width="${op.width}" height="${op.height}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}"/>`,
        animationClass: 'fade',
      }
    }
    case 'polygon': {
      const stroke = resolveColor(op.stroke)
      const fill = op.fill ? resolveColor(op.fill) : 'none'
      const sw = op.strokeWidth ?? 2
      const pts = op.points.map(([x, y]) => `${x},${y}`).join(' ')
      return {
        svg: `<polygon id="${id}" class="ge2-fade" points="${pts}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}"/>`,
        animationClass: 'fade',
      }
    }
    case 'path': {
      const stroke = resolveColor(op.stroke)
      const fill = op.fill ? resolveColor(op.fill) : 'none'
      const sw = op.strokeWidth ?? 2
      // Path d-attribute is validated by Zod for length; SVG parser
      // ignores unknown commands so no injection risk via content.
      return {
        svg: `<path id="${id}" class="ge2-path" d="${escapeXml(op.d)}" stroke="${stroke}" fill="${fill}" stroke-width="${sw}" stroke-linecap="round"/>`,
        animationClass: 'path',
      }
    }
    case 'text': {
      const color = resolveColor(op.color, 'currentColor')
      const size = op.fontSize ?? 14
      const anchor = op.anchor ?? 'middle'
      return {
        svg: `<text id="${id}" class="ge2-fade" x="${op.x}" y="${op.y}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-family="sans-serif">${escapeXml(op.text)}</text>`,
        animationClass: 'fade',
      }
    }
    case 'point': {
      const color = resolveColor(op.color, '#111827')
      const r = op.r ?? 4
      const size = op.fontSize ?? 12
      const labelSvg = op.label
        ? `<text class="ge2-point-label" x="${op.x}" y="${op.y - r - 6}" font-size="${size}" fill="${color}" text-anchor="middle" font-family="sans-serif">${escapeXml(op.label)}</text>`
        : ''
      return {
        svg: `<g id="${id}" class="ge2-fade"><circle cx="${op.x}" cy="${op.y}" r="${r}" fill="${color}"/>${labelSvg}</g>`,
        animationClass: 'fade',
      }
    }
    case 'equation': {
      // Equation renders via KaTeX in a <foreignObject>. Since KaTeX is
      // not available inside an inline SVG string, we render a <text>
      // placeholder with the raw LaTeX. The runtime replaces it with
      // KaTeX-rendered HTML during mount (see MathCanvasRenderer).
      const size = op.fontSize ?? 16
      return {
        svg: `<foreignObject id="${id}" class="ge2-fade ge2-equation" x="${op.x}" y="${op.y}" width="400" height="${size * 2}"><div xmlns="http://www.w3.org/1999/xhtml" data-latex="${escapeXml(op.latex)}" style="font-size:${size}px"></div></foreignObject>`,
        animationClass: 'fade',
      }
    }
    default:
      return null
  }
}

/** Static SVG defs shared by the scene (arrow marker etc.). */
export const SVG_DEFS = `<defs>
  <marker id="ge2-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
  </marker>
</defs>`
