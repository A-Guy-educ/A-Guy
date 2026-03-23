/**
 * Parses TikZ \begin{axis}[...] environments into AxisSpecV1 blocks.
 *
 * Handles:
 * - \begin{axis}[xmin=..., xmax=..., ymin=..., ymax=...] for viewport
 * - \addplot[domain=a:b, ...] {expression} for function graphs
 * - \addplot[only marks] coordinates {(x,y)...} for scatter points
 * - \addplot[fill=...] {expression} \closedcycle for paint/fill areas
 * - \draw[dashed] (axis cs:...) -- (axis cs:...) for asymptotes
 * - \node at (axis cs:...) {text} for floating text labels
 * - \draw [domain=a:b] plot (\x, {expression}) for raw TikZ function plots
 */

import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import type { QuestionAxisBlock } from '@/server/payload/collections/Exercises/types'
import { makeAxisBlock } from '@/lib/latex-parser/block-generators'
import { generateId } from '@/server/payload/collections/Exercises/types'

/** Parse key=value options from [key=val, key2=val2], respecting brace groups */
function parseOptions(optionStr: string): Record<string, string> {
  const opts: Record<string, string> = {}
  // Split on commas that are NOT inside braces
  const pairs: string[] = []
  let current = ''
  let braceDepth = 0
  for (const ch of optionStr) {
    if (ch === '{') braceDepth++
    else if (ch === '}') braceDepth--
    if (ch === ',' && braceDepth === 0) {
      pairs.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) pairs.push(current)

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
    .replace(/\\\*/g, '*')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\^(\d+)/g, '^$1')
    .replace(/\{([^}]+)\}/g, '($1)')
    .trim()
}

/** Parse \addplot commands from tikzpicture content */
function parseAddPlots(content: string): {
  graphs: AxisSpecV1['elements']['graphs']
  points: AxisSpecV1['elements']['points']
  fillRanges: Array<{ fn: string; fromX: number; toX: number }>
} {
  const graphs: AxisSpecV1['elements']['graphs'] = []
  const points: AxisSpecV1['elements']['points'] = []
  const fillRanges: Array<{ fn: string; fromX: number; toX: number }> = []

  // Match \addplot[options] {expression} or \addplot[options] expression;
  const plotRegex = /\\addplot\s*\[([^\]]*)\]\s*\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = plotRegex.exec(content)) !== null) {
    const opts = parseOptions(match[1])
    const expr = match[2]

    if (opts['fill'] || opts['draw'] === 'none') {
      // Area fill — extract as paint range
      if (opts['domain']) {
        const [from, to] = opts['domain'].split(':').map(Number)
        if (!isNaN(from) && !isNaN(to)) {
          fillRanges.push({ fn: latexToFnString(expr), fromX: from, toX: to })
        }
      }
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

  return { graphs, points, fillRanges }
}

/**
 * Parse \draw ... plot (\x, {expression}); commands from raw TikZ
 * (outside \begin{axis} environments, e.g. exercise 8)
 */
function parseDrawPlots(content: string): {
  graphs: AxisSpecV1['elements']['graphs']
  viewport: { xMin: number; xMax: number; yMin: number; yMax: number }
} {
  const graphs: AxisSpecV1['elements']['graphs'] = []
  let globalXMin = Infinity
  let globalXMax = -Infinity

  // Match \draw [options] plot (\x, {expression});
  const drawPlotRegex = /\\draw\s*\[([^\]]*)\]\s*plot\s*\(\\x\s*,\s*\{([^}]+)\}\s*\)\s*;/g
  let match: RegExpExecArray | null
  while ((match = drawPlotRegex.exec(content)) !== null) {
    const opts = parseOptions(match[1])
    const rawExpr = match[2]

    // Convert \x to x in the expression
    const expr = latexToFnString(rawExpr.replace(/\\x/g, 'x'))
    const style = opts['dashed'] ? 'dashed' : ('solid' as const)
    const thickness = opts['thick'] ? 2 : 1
    const range: { fromX?: number | null; toX?: number | null } = {}

    if (opts['domain']) {
      const [from, to] = opts['domain'].split(':').map(Number)
      if (!isNaN(from)) {
        range.fromX = from
        globalXMin = Math.min(globalXMin, from)
      }
      if (!isNaN(to)) {
        range.toX = to
        globalXMax = Math.max(globalXMax, to)
      }
    }

    graphs.push({
      id: generateId(),
      fn: expr,
      style,
      thickness,
      range: Object.keys(range).length > 0 ? range : undefined,
    })
  }

  // Infer viewport from axis lines: \draw[-latex] (xmin,0) -- (xmax,0)
  const xAxisMatch = /\\draw\s*\[-?(?:latex|>)\]\s*\(([^,]+),\s*0\)\s*--\s*\(([^,]+),\s*0\)/.exec(
    content,
  )
  const yAxisMatch = /\\draw\s*\[-?(?:latex|>)\]\s*\(0,\s*([^)]+)\)\s*--\s*\(0,\s*([^)]+)\)/.exec(
    content,
  )

  const xMin = xAxisMatch ? parseFloat(xAxisMatch[1]) : globalXMin !== Infinity ? globalXMin : -10
  const xMax = xAxisMatch ? parseFloat(xAxisMatch[2]) : globalXMax !== -Infinity ? globalXMax : 10
  const yMin = yAxisMatch ? parseFloat(yAxisMatch[1]) : -10
  const yMax = yAxisMatch ? parseFloat(yAxisMatch[2]) : 10

  return { graphs, viewport: { xMin, xMax, yMin, yMax } }
}

/**
 * Parse \draw[dashed] (axis cs:X1,Y1) -- (axis cs:X2,Y2) lines inside axis environments.
 * Detects vertical and horizontal asymptotes.
 */
function parseAsymptotes(content: string): {
  vertical: number[]
  horizontal: number[]
} {
  const vertical: number[] = []
  const horizontal: number[] = []

  // Match \draw[dashed] (axis cs:X1,Y1) -- (axis cs:X2,Y2);
  const drawRegex =
    /\\draw\s*\[([^\]]*dashed[^\]]*)\]\s*\(axis\s+cs:\s*([^,]+),\s*([^)]+)\)\s*--\s*\(axis\s+cs:\s*([^,]+),\s*([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = drawRegex.exec(content)) !== null) {
    const x1 = parseFloat(match[2])
    const y1 = parseFloat(match[3])
    const x2 = parseFloat(match[4])
    const y2 = parseFloat(match[5])

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) continue

    // Vertical asymptote: same X, different Y
    if (Math.abs(x1 - x2) < 0.001) {
      vertical.push(x1)
    }
    // Horizontal asymptote: same Y, different X
    if (Math.abs(y1 - y2) < 0.001) {
      horizontal.push(y1)
    }
  }

  return { vertical, horizontal }
}

/**
 * Parse \node at (axis cs:X,Y) {...} for text labels and point markers.
 */
function parseAxisNodes(content: string): AxisSpecV1['elements']['points'] {
  const nodePoints: AxisSpecV1['elements']['points'] = []

  // Match \node at (axis cs:X,Y) [options] {text};  OR  \node at (axis cs:X,Y) {text};
  const nodeRegex =
    /\\node\s*(?:\[([^\]]*)\])?\s*at\s*\(axis\s+cs:\s*([^,]+),\s*([^)]+)\)\s*(?:\[([^\]]*)\])?\s*\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = nodeRegex.exec(content)) !== null) {
    const beforeOpts = match[1] ?? ''
    const x = parseFloat(match[2])
    const y = parseFloat(match[3])
    const afterOpts = match[4] ?? ''
    const text = match[5].replace(/\$/g, '').trim()

    if (isNaN(x) || isNaN(y)) continue

    const allOpts = `${beforeOpts} ${afterOpts}`

    // Node with circle,fill → point marker (no label)
    if (allOpts.includes('circle') && allOpts.includes('fill')) {
      nodePoints.push({ x, y, type: 'point' as const })
    } else if (text) {
      // Node with text → floating text label
      nodePoints.push({ x, y, type: 'floating_text' as const, label: text })
    }
  }

  return nodePoints
}

/** Parse axis options [xmin=..., xmax=..., ...] */
function parseAxisOptions(content: string): {
  viewport: { xMin?: number; xMax?: number; yMin?: number; yMax?: number }
  labels: { x: string; y: string }
  showGrid: boolean
  showNumbers: boolean
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
  const showNumbers = opts['ticks'] !== 'none'

  // Parse xtick values
  const ticks: number[] = []
  if (opts['xtick']) {
    const tickStr = opts['xtick'].replace(/[{}]/g, '')
    tickStr.split(',').forEach((t) => {
      const n = parseFloat(t.trim())
      if (!isNaN(n)) ticks.push(n)
    })
  }

  return { viewport, labels: { x: xlabel, y: ylabel }, showGrid, showNumbers, ticks }
}

/**
 * Attach fill ranges as paint.underGraph on matching graphs.
 * Matches fill ranges to graphs by comparing function strings.
 */
function attachFillAreas(
  graphs: AxisSpecV1['elements']['graphs'],
  fillRanges: Array<{ fn: string; fromX: number; toX: number }>,
): void {
  for (const fill of fillRanges) {
    // Find the graph with the same function
    const target = graphs.find((g) => g.fn === fill.fn)
    if (target) {
      if (!target.paint) target.paint = {}
      if (!target.paint.underGraph) target.paint.underGraph = []
      target.paint.underGraph.push({ fromX: fill.fromX, toX: fill.toX })
    }
  }
}

/**
 * Attempts to parse a tikzpicture containing an axis environment
 * into a QuestionAxisBlock. Returns null if no axis found.
 */
export function parseTikzAxis(tikzContent: string): QuestionAxisBlock | null {
  if (!tikzContent.includes('\\begin{axis}')) return null

  const {
    viewport,
    labels,
    showGrid,
    showNumbers,
    ticks: tickValues,
  } = parseAxisOptions(tikzContent)
  const { graphs, points, fillRanges } = parseAddPlots(tikzContent)
  const asymptotes = parseAsymptotes(tikzContent)
  const nodePoints = parseAxisNodes(tikzContent)

  const allPoints = [...points, ...nodePoints]

  if (graphs.length === 0 && allPoints.length === 0) return null

  // Attach fill areas to matching graphs
  if (fillRanges.length > 0) {
    attachFillAreas(graphs, fillRanges)
  }

  const xMin = viewport.xMin ?? -5
  const xMax = viewport.xMax ?? 5
  const yMin = viewport.yMin ?? -5
  const yMax = viewport.yMax ?? 5

  // Derive tick interval from parsed xtick values, or infer from viewport range
  let tickInterval = 1
  if (tickValues.length >= 2) {
    tickInterval = Math.abs(tickValues[1] - tickValues[0])
  } else {
    // Auto-derive a reasonable interval when no xtick specified
    const range = Math.max(xMax - xMin, yMax - yMin)
    if (range > 50) tickInterval = 10
    else if (range > 20) tickInterval = 5
    else if (range > 10) tickInterval = 2
  }

  const axis: AxisSpecV1 = {
    kind: 'cartesian',
    units: 1,
    viewportMode: 'manual',
    grid: { enabled: showGrid },
    axes: {
      showNumbers,
      showLabels: showNumbers,
      ticks: tickInterval,
      labels,
      origin: { x: 0, y: 0 },
    },
    viewport: { xMin, xMax, yMin, yMax },
    elements: {
      points: allPoints,
      graphs,
      ...(asymptotes.vertical.length > 0 && { asymptotesVertical: asymptotes.vertical }),
      ...(asymptotes.horizontal.length > 0 && { asymptotesHorizontal: asymptotes.horizontal }),
    },
  }

  return makeAxisBlock('', axis)
}

/**
 * Attempts to parse a tikzpicture with raw \draw ... plot commands
 * (without \begin{axis}) into a QuestionAxisBlock.
 * Returns null if no plot commands found.
 */
export function parseTikzDrawPlot(tikzContent: string): QuestionAxisBlock | null {
  // Only handle content without \begin{axis} (that's handled by parseTikzAxis)
  if (tikzContent.includes('\\begin{axis}')) return null

  const { graphs, viewport } = parseDrawPlots(tikzContent)
  if (graphs.length === 0) return null

  // Parse any coordinate-based points referenced in the TikZ
  const coordPoints: AxisSpecV1['elements']['points'] = []
  const fillRegex = /\\fill\s*\((\w+)\)\s*circle\s*\([^)]+\)\s*node\s*\[[^\]]*\]\s*\{([^}]*)\}/g
  const coordRegex = /\\coordinate\s*\((\w+)\)\s*at\s*\(([^)]+)\)/g
  const coordMap = new Map<string, { x: number; y: number }>()

  let match: RegExpExecArray | null
  while ((match = coordRegex.exec(tikzContent)) !== null) {
    const coords = match[2].split(',').map((s) => parseFloat(s.trim()))
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      coordMap.set(match[1], { x: coords[0], y: coords[1] })
    }
  }

  while ((match = fillRegex.exec(tikzContent)) !== null) {
    const name = match[1]
    const label = match[2].replace(/\$/g, '').trim()
    const coord = coordMap.get(name)
    if (coord) {
      coordPoints.push({
        x: coord.x,
        y: coord.y,
        type: 'point' as const,
        label: label || name,
      })
    }
  }

  const axis: AxisSpecV1 = {
    kind: 'cartesian',
    units: 1,
    viewportMode: 'manual',
    grid: { enabled: false },
    axes: {
      showNumbers: true,
      showLabels: true,
      ticks: 1,
      labels: { x: 'x', y: 'y' },
      origin: { x: 0, y: 0 },
    },
    viewport,
    elements: {
      points: coordPoints,
      graphs,
    },
  }

  return makeAxisBlock('', axis)
}

/** Check if a tikzpicture contains an axis environment */
export function hasTikzAxis(content: string): boolean {
  return content.includes('\\begin{axis}')
}

/** Check if a tikzpicture contains \draw ... plot commands (raw function plots) */
export function hasTikzDrawPlot(content: string): boolean {
  return /\\draw\s*\[[^\]]*\]\s*plot\s*\(\\x/.test(content)
}
