/**
 * Parses TikZ \begin{axis}[...] environments into AxisSpecV1 blocks.
 *
 * Handles:
 * - \begin{axis}[xmin=..., xmax=..., ymin=..., ymax=...] for viewport
 * - \addplot[domain=a:b, ...] {expression} for function graphs
 * - \addplot[only marks] coordinates {(x,y)...} for scatter points
 * - Vertical/horizontal asymptotes from \draw[dashed]
 */

import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import type { QuestionAxisBlock } from '@/server/payload/collections/Exercises/types'
import { makeAxisBlock } from '@/lib/latex-parser/block-generators'
import { generateId } from '@/server/payload/collections/Exercises/types'

/** Parse key=value options from [key=val, key2=val2] */
function parseOptions(optionStr: string): Record<string, string> {
  const opts: Record<string, string> = {}
  // Simple key=value parser (doesn't handle nested braces perfectly)
  const pairs = optionStr.split(',')
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=')
    if (eqIdx !== -1) {
      const key = pair.slice(0, eqIdx).trim()
      const val = pair.slice(eqIdx + 1).trim()
      opts[key] = val
    } else {
      const trimmed = pair.trim()
      if (trimmed) opts[trimmed] = 'true'
    }
  }
  return opts
}

/** Convert LaTeX math expression to a simpler function string */
function latexToFnString(latex: string): string {
  return latex
    .replace(/\\cdot/g, '*')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\^2/g, '^2')
    .replace(/\{([^}]+)\}/g, '($1)')
    .trim()
}

/** Parse \addplot commands from tikzpicture content */
function parseAddPlots(
  content: string,
): { graphs: AxisSpecV1['elements']['graphs']; points: AxisSpecV1['elements']['points'] } {
  const graphs: AxisSpecV1['elements']['graphs'] = []
  const points: AxisSpecV1['elements']['points'] = []

  // Match \addplot[options] {expression} or \addplot[options] expression;
  const plotRegex = /\\addplot\s*\[([^\]]*)\]\s*\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = plotRegex.exec(content)) !== null) {
    const opts = parseOptions(match[1])
    const expr = match[2]

    if (opts['fill'] || opts['draw'] === 'none') {
      // Area fill — skip or convert to paint later
      continue
    }

    const style = opts['dashed'] ? 'dashed' : ('solid' as const)
    const thickness = opts['thick'] ? 2 : 1
    const range: { fromX?: number | null; toX?: number | null } = {}

    if (opts['domain']) {
      const [from, to] = opts['domain'].split(':').map(Number)
      if (!isNaN(from)) range.fromX = from
      if (!isNaN(to)) range.toX = to
    }

    graphs.push({
      id: generateId(),
      fn: latexToFnString(expr),
      style,
      thickness,
      range: Object.keys(range).length > 0 ? range : undefined,
    })
  }

  // Match \addplot[only marks] coordinates {(x1,y1) (x2,y2) ...}
  const coordRegex = /\\addplot\s*\[([^\]]*only\s+marks[^\]]*)\]\s*coordinates\s*\{([^}]+)\}/g
  while ((match = coordRegex.exec(content)) !== null) {
    const coordStr = match[2]
    const coordPairs = coordStr.match(/\(([^)]+)\)/g)
    if (coordPairs) {
      for (const pair of coordPairs) {
        const nums = pair.replace(/[()]/g, '').split(',').map(Number)
        if (nums.length === 2 && !isNaN(nums[0]) && !isNaN(nums[1])) {
          points.push({ x: nums[0], y: nums[1], type: 'point' as const })
        }
      }
    }
  }

  return { graphs, points }
}

/** Parse axis options [xmin=..., xmax=..., ...] */
function parseAxisOptions(content: string): {
  viewport: { xMin?: number; xMax?: number; yMin?: number; yMax?: number }
  labels: { x: string; y: string }
  showGrid: boolean
  ticks: number[]
} {
  const axisOptsMatch = /\\begin\{axis\}\s*\[([^\]]*)\]/s.exec(content)
  const opts = axisOptsMatch ? parseOptions(axisOptsMatch[1]) : {}

  const viewport: { xMin?: number; xMax?: number; yMin?: number; yMax?: number } = {}
  if (opts['xmin']) viewport.xMin = parseFloat(opts['xmin'])
  if (opts['xmax']) viewport.xMax = parseFloat(opts['xmax'])
  if (opts['ymin']) viewport.yMin = parseFloat(opts['ymin'])
  if (opts['ymax']) viewport.yMax = parseFloat(opts['ymax'])

  const xlabel = opts['xlabel']?.replace(/[{}$]/g, '') ?? 'x'
  const ylabel = opts['ylabel']?.replace(/[{}$]/g, '') ?? 'y'
  const showGrid = opts['grid'] === 'major' || opts['grid'] === 'both'

  // Parse xtick values
  const ticks: number[] = []
  if (opts['xtick']) {
    const tickStr = opts['xtick'].replace(/[{}]/g, '')
    tickStr.split(',').forEach((t) => {
      const n = parseFloat(t.trim())
      if (!isNaN(n)) ticks.push(n)
    })
  }

  return { viewport, labels: { x: xlabel, y: ylabel }, showGrid, ticks }
}

/**
 * Attempts to parse a tikzpicture containing an axis environment
 * into a QuestionAxisBlock. Returns null if no axis found.
 */
export function parseTikzAxis(tikzContent: string): QuestionAxisBlock | null {
  if (!tikzContent.includes('\\begin{axis}')) return null

  const { viewport, labels, showGrid } = parseAxisOptions(tikzContent)
  const { graphs, points } = parseAddPlots(tikzContent)

  if (graphs.length === 0 && points.length === 0) return null

  const xMin = viewport.xMin ?? -10
  const xMax = viewport.xMax ?? 10
  const yMin = viewport.yMin ?? -10
  const yMax = viewport.yMax ?? 10

  const axis: AxisSpecV1 = {
    kind: 'cartesian',
    units: 1,
    grid: { enabled: showGrid },
    axes: {
      showNumbers: true,
      showLabels: true,
      ticks: 1,
      labels,
      origin: { x: 0, y: 0 },
    },
    viewport: { xMin, xMax, yMin, yMax },
    elements: {
      points,
      graphs,
    },
  }

  return makeAxisBlock('', axis)
}

/** Check if a tikzpicture contains an axis environment */
export function hasTikzAxis(content: string): boolean {
  return content.includes('\\begin{axis}')
}
