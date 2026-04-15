/**
 * Converts an InteractiveLesson (from the Gemini generation pipeline)
 * into a GuidedExplanationV1 payload that the trusted HTML block renderer
 * can execute. This bridges the two systems: the LLM generates structured
 * geometry + steps, and the GuidedExplanationRunner renders them.
 */
import type {
  GuidedExplanationV1,
  GuidedExplanationAction,
} from '@/infra/contracts/guided-explanation/v1'
import type { InteractiveLesson, GeometryData, GeoPoint } from './interactive-lesson-types'

// ---------------------------------------------------------------------------
// SVG generation from structured geometry data
// ---------------------------------------------------------------------------

/** Escape XML special chars to prevent DOM breakage from LLM-supplied labels. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip a label to alphanumeric only — used in id attributes. */
function safeLabel(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\-]/g, '')
}

/** Allowlist segment colors — maps known names to hex, falls back to blue. */
const COLOR_MAP: Record<string, string> = {
  blue: '#2563eb',
  red: '#ef4444',
  green: '#10b981',
  orange: '#f59e0b',
  purple: '#8b5cf6',
}
function safeColor(color: string | undefined): string {
  if (!color) return COLOR_MAP.blue
  if (COLOR_MAP[color]) return COLOR_MAP[color]
  if (/^#[0-9a-fA-F]{3,8}$/.test(color)) return color
  return COLOR_MAP.blue
}

function pointMap(geometry: GeometryData): Map<string, GeoPoint> {
  const map = new Map<string, GeoPoint>()
  for (const p of geometry.points) map.set(p.label, p)
  return map
}

/** Canonical segment id — always alphabetically sorted so A-D and D-A map to the same id. */
function segmentId(from: string, to: string): string {
  const a = safeLabel(from)
  const b = safeLabel(to)
  return a < b ? `seg-${a}-${b}` : `seg-${b}-${a}`
}

function buildSvg(geometry: GeometryData): string {
  const pts = pointMap(geometry)
  const lines: string[] = []

  lines.push(
    `<svg viewBox="0 0 ${geometry.width} ${geometry.height}" xmlns="http://www.w3.org/2000/svg">`,
  )
  lines.push('  <g font-family="sans-serif" font-size="16" font-weight="500" fill="currentColor">')

  // Segments
  for (const seg of geometry.segments) {
    const p1 = pts.get(seg.from)
    const p2 = pts.get(seg.to)
    if (!p1 || !p2) continue
    // Allowlist: only known color names map to hex; anything else falls back.
    // Prevents attribute breakout from a hallucinated color like `red" foo="bar`.
    const color = safeColor(seg.color)
    const width = seg.style === 'bold' ? 4 : 3
    const dasharray = seg.style === 'dashed' ? ' stroke-dasharray="8 4"' : ''
    const id = segmentId(seg.from, seg.to)
    lines.push(
      `    <line id="${id}" class="ge-draw-path" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dasharray} fill="none"/>`,
    )
  }

  // Angle arcs
  if (geometry.angles) {
    for (let i = 0; i < geometry.angles.length; i++) {
      const angle = geometry.angles[i]
      const [p1Label, vertexLabel, p2Label] = angle.points
      const p1 = pts.get(p1Label)
      const vertex = pts.get(vertexLabel)
      const p2 = pts.get(p2Label)
      if (!p1 || !vertex || !p2) continue

      const id = `angle-${vertexLabel}-${i}`
      if (angle.rightAngle) {
        const size = 12
        const dx1 = ((p1.x - vertex.x) / Math.hypot(p1.x - vertex.x, p1.y - vertex.y)) * size
        const dy1 = ((p1.y - vertex.y) / Math.hypot(p1.x - vertex.x, p1.y - vertex.y)) * size
        const dx2 = ((p2.x - vertex.x) / Math.hypot(p2.x - vertex.x, p2.y - vertex.y)) * size
        const dy2 = ((p2.y - vertex.y) / Math.hypot(p2.x - vertex.x, p2.y - vertex.y)) * size
        lines.push(
          `    <path id="${id}" class="ge-draw-path-fast" d="M ${vertex.x + dx1} ${vertex.y + dy1} L ${vertex.x + dx1 + dx2} ${vertex.y + dy1 + dy2} L ${vertex.x + dx2} ${vertex.y + dy2}" fill="none" stroke="#8b5cf6" stroke-width="2"/>`,
        )
      } else {
        const radius = 20
        const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x)
        const a2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x)
        const sx = vertex.x + radius * Math.cos(a1)
        const sy = vertex.y + radius * Math.sin(a1)
        const ex = vertex.x + radius * Math.cos(a2)
        const ey = vertex.y + radius * Math.sin(a2)
        lines.push(
          `    <path id="${id}" class="ge-draw-path-fast" d="M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>`,
        )
      }
    }
  }

  // Point labels
  for (const p of geometry.points) {
    const offsetY = p.y < geometry.height / 2 ? -12 : 20
    lines.push(
      `    <text id="label-${safeLabel(p.label)}" class="ge-fade-element" x="${p.x}" y="${p.y + offsetY}" text-anchor="middle">${escapeXml(p.label)}</text>`,
    )
  }

  // Additional labels (measurements etc.)
  if (geometry.labels) {
    for (let i = 0; i < geometry.labels.length; i++) {
      const lbl = geometry.labels[i]
      const fontSize = Math.min(Math.max(Number(lbl.fontSize) || 12, 8), 48)
      lines.push(
        `    <text id="geo-label-${i}" class="ge-fade-element" x="${lbl.x}" y="${lbl.y}" font-size="${fontSize}" text-anchor="middle">${escapeXml(lbl.text)}</text>`,
      )
    }
  }

  lines.push('  </g>')
  lines.push('</svg>')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Step conversion
// ---------------------------------------------------------------------------

function buildStepActions(
  step: InteractiveLesson['steps'][number],
  stepIndex: number,
  allPreviousSegments: Set<string>,
  allPreviousPoints: Set<string>,
): GuidedExplanationAction[] {
  const actions: GuidedExplanationAction[] = []

  // Draw/show segments new to this step
  if (step.highlightSegments) {
    for (const [from, to] of step.highlightSegments) {
      const id = segmentId(from, to)
      if (!allPreviousSegments.has(id)) {
        actions.push({ op: 'draw', id })
        allPreviousSegments.add(id)
      }
    }
  }

  // Show point labels new to this step
  if (step.highlightPoints) {
    for (const label of step.highlightPoints) {
      const id = `label-${safeLabel(label)}`
      if (!allPreviousPoints.has(id)) {
        actions.push({ op: 'show', id })
        allPreviousPoints.add(id)
      }
    }
  }

  // Highlight the proof table row
  actions.push({ op: 'highlightRow', rowId: `row-${stepIndex + 1}` })

  return actions
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

export function interactiveLessonToGuidedExplanation(
  lesson: InteractiveLesson,
): GuidedExplanationV1 {
  const svg = buildSvg(lesson.geometry)
  const direction = lesson.locale === 'he' ? 'rtl' : 'ltr'

  const seenSegments = new Set<string>()
  const seenPoints = new Set<string>()

  const steps = lesson.steps.map((step, i) => ({
    id: `step-${step.id}`,
    actions: buildStepActions(step, i, seenSegments, seenPoints),
    narrate: {
      display: step.narration,
    },
  }))

  return {
    version: 'guided-explanation/v1',
    title: lesson.title,
    direction,
    locale: lesson.locale,
    scene: {
      svg,
      viewBox: `0 0 ${lesson.geometry.width} ${lesson.geometry.height}`,
    },
    proofTable: {
      columns: [
        '#',
        lesson.locale === 'he' ? 'טענה' : 'Claim',
        lesson.locale === 'he' ? 'נימוק' : 'Reason',
      ],
      rows: lesson.steps.map((step, i) => ({
        id: `row-${i + 1}`,
        claim: step.claim,
        reason: step.reason,
      })),
    },
    narrationBox: {
      placeholder: lesson.locale === 'he' ? 'לחצו על הפעלה כדי להתחיל.' : 'Press play to start.',
    },
    controls: {
      playLabel: lesson.locale === 'he' ? 'הפעלה' : 'Play',
      resetLabel: lesson.locale === 'he' ? 'איפוס' : 'Reset',
    },
    steps,
  }
}
