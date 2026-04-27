/**
 * Converts an InteractiveLesson (from the Gemini generation pipeline)
 * into a GuidedExplanationV1 payload that the trusted HTML block renderer
 * can execute. This bridges the two systems: the LLM generates structured
 * primitives, and the GuidedExplanationRunner renders them.
 *
 * Two scene kinds:
 *  - geometry: segments/points/angles from a diagram.
 *  - equation: a stack of big centered text elements, one per step. Used
 *    when the lesson has no geometric figure (algebra, calculus, etc.) —
 *    step actions fade the previous claim out and the next one in, so the
 *    scene pane stays visually active instead of sitting empty.
 */
import type {
  GuidedExplanationV1,
  GuidedExplanationAction,
} from '@/infra/contracts/guided-explanation/v1'
import type {
  GeoPoint,
  GeometryData,
  GraphData,
  GraphMarker,
  GraphPlot,
  InteractiveLesson,
  NumberLineData,
  NumberLineInterval,
  NumberLineMark,
} from './interactive-lesson-types'

// ---------------------------------------------------------------------------
// Shared helpers
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

// ---------------------------------------------------------------------------
// Geometry scene
// ---------------------------------------------------------------------------

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

function buildGeometrySvg(geometry: GeometryData): string {
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

function buildGeometryStepActions(
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
// Graph scene — coordinate plane with plotted functions and marked points
// ---------------------------------------------------------------------------

const GRAPH_SCENE_WIDTH = 600
const GRAPH_SCENE_HEIGHT = 400
const GRAPH_PADDING = 40

interface GraphLayout {
  xRange: [number, number]
  yRange: [number, number]
  plotWidth: number
  plotHeight: number
  originX: number
  originY: number
  xToSvg: (x: number) => number
  yToSvg: (y: number) => number
}

function layoutGraph(graph: GraphData): GraphLayout {
  const [xMin, xMax] = graph.xRange
  const [yMin, yMax] = graph.yRange
  const plotWidth = GRAPH_SCENE_WIDTH - 2 * GRAPH_PADDING
  const plotHeight = GRAPH_SCENE_HEIGHT - 2 * GRAPH_PADDING
  const xSpan = xMax - xMin || 1
  const ySpan = yMax - yMin || 1
  const xToSvg = (x: number) => GRAPH_PADDING + ((x - xMin) / xSpan) * plotWidth
  // y-axis is inverted in SVG (top-left origin)
  const yToSvg = (y: number) => GRAPH_PADDING + ((yMax - y) / ySpan) * plotHeight
  const originX = xToSvg(0)
  const originY = yToSvg(0)
  return {
    xRange: graph.xRange,
    yRange: graph.yRange,
    plotWidth,
    plotHeight,
    originX,
    originY,
    xToSvg,
    yToSvg,
  }
}

/** Tick positions along one axis, stepping by `step` and including 0 if in range. */
function axisTicks(min: number, max: number, step: number): number[] {
  if (step <= 0) return []
  const out: number[] = []
  const start = Math.ceil(min / step) * step
  for (let v = start; v <= max + step * 0.0001; v += step) {
    // Round to 10 decimals to avoid floating-point drift
    out.push(Math.round(v * 1e10) / 1e10)
  }
  return out
}

function formatTick(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(1).replace(/\.0$/, '')
}

function buildAxes(graph: GraphData, layout: GraphLayout): string[] {
  const lines: string[] = []
  const axisColor = 'currentColor'
  const gridColor = 'currentColor'

  const [xMin, xMax] = graph.xRange
  const [yMin, yMax] = graph.yRange

  const xAxisY = Math.min(
    Math.max(layout.yToSvg(0), GRAPH_PADDING),
    GRAPH_SCENE_HEIGHT - GRAPH_PADDING,
  )
  const yAxisX = Math.min(
    Math.max(layout.xToSvg(0), GRAPH_PADDING),
    GRAPH_SCENE_WIDTH - GRAPH_PADDING,
  )

  // Gridlines + ticks + tick labels
  const xStep = graph.xStep ?? 1
  const yStep = graph.yStep ?? 1

  for (const xTick of axisTicks(xMin, xMax, xStep)) {
    const x = layout.xToSvg(xTick)
    lines.push(
      `    <line x1="${x}" y1="${GRAPH_PADDING}" x2="${x}" y2="${GRAPH_SCENE_HEIGHT - GRAPH_PADDING}" stroke="${gridColor}" stroke-opacity="0.1" stroke-width="1" />`,
    )
    if (xTick !== 0) {
      lines.push(
        `    <text x="${x}" y="${xAxisY + 14}" text-anchor="middle" font-size="11" fill="${axisColor}" opacity="0.6">${formatTick(xTick)}</text>`,
      )
    }
  }
  for (const yTick of axisTicks(yMin, yMax, yStep)) {
    const y = layout.yToSvg(yTick)
    lines.push(
      `    <line x1="${GRAPH_PADDING}" y1="${y}" x2="${GRAPH_SCENE_WIDTH - GRAPH_PADDING}" y2="${y}" stroke="${gridColor}" stroke-opacity="0.1" stroke-width="1" />`,
    )
    if (yTick !== 0) {
      lines.push(
        `    <text x="${yAxisX - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="${axisColor}" opacity="0.6">${formatTick(yTick)}</text>`,
      )
    }
  }

  // Axes themselves
  lines.push(
    `    <line x1="${GRAPH_PADDING}" y1="${xAxisY}" x2="${GRAPH_SCENE_WIDTH - GRAPH_PADDING}" y2="${xAxisY}" stroke="${axisColor}" stroke-width="1.5" opacity="0.7" />`,
  )
  lines.push(
    `    <line x1="${yAxisX}" y1="${GRAPH_PADDING}" x2="${yAxisX}" y2="${GRAPH_SCENE_HEIGHT - GRAPH_PADDING}" stroke="${axisColor}" stroke-width="1.5" opacity="0.7" />`,
  )
  return lines
}

function plotPathD(plot: GraphPlot, layout: GraphLayout): string {
  const parts: string[] = []
  let pen = 'M'
  for (const [x, y] of plot.points) {
    // Skip points outside the y-range — split the path instead of drawing a
    // vertical streak across an asymptote.
    const inY = y >= layout.yRange[0] && y <= layout.yRange[1]
    if (!inY) {
      pen = 'M'
      continue
    }
    parts.push(`${pen} ${layout.xToSvg(x).toFixed(2)} ${layout.yToSvg(y).toFixed(2)}`)
    pen = 'L'
  }
  return parts.join(' ')
}

function buildPlot(plot: GraphPlot, layout: GraphLayout): string[] {
  if (plot.points.length < 2) return []
  const color = safeColor(plot.color)
  const dasharray = plot.style === 'dashed' ? ' stroke-dasharray="8 4"' : ''
  const d = plotPathD(plot, layout)
  if (!d) return []
  const id = `plot-${safeLabel(plot.id)}`
  const lines: string[] = [
    `    <path id="${id}" class="ge-draw-path" d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${dasharray} />`,
  ]
  if (plot.label) {
    const last = plot.points[plot.points.length - 1]
    const lx = layout.xToSvg(last[0]) + 6
    const ly = layout.yToSvg(last[1])
    lines.push(
      `    <text id="${id}-label" class="ge-fade-element" x="${lx}" y="${ly}" font-size="13" fill="${color}" font-weight="600">${escapeXml(plot.label)}</text>`,
    )
  }
  return lines
}

function buildMarker(marker: GraphMarker, layout: GraphLayout): string {
  const cx = layout.xToSvg(marker.x)
  const cy = layout.yToSvg(marker.y)
  const color = safeColor(marker.color)
  const id = `marker-${safeLabel(marker.id)}`
  const labelText = marker.label
    ? `<text x="${cx + 8}" y="${cy - 8}" font-size="12" fill="currentColor" font-weight="600">${escapeXml(marker.label)}</text>`
    : ''
  // Halo stroke uses the scene background color (via CSS class) so the
  // marker dot stays visually separated from the curve in both light and
  // dark themes — a hardcoded "white" stroke would disappear in dark mode.
  return `    <g id="${id}" class="ge-fade-element"><circle cx="${cx}" cy="${cy}" r="5" fill="${color}" stroke-width="2" class="ge-bg-stroke" />${labelText}</g>`
}

function buildGraphSvg(graph: GraphData): string {
  const layout = layoutGraph(graph)
  const lines: string[] = []
  lines.push(
    `<svg viewBox="0 0 ${GRAPH_SCENE_WIDTH} ${GRAPH_SCENE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
  )
  lines.push('  <g font-family="sans-serif" fill="currentColor">')

  lines.push(...buildAxes(graph, layout))
  for (const plot of graph.plots) {
    lines.push(...buildPlot(plot, layout))
  }
  for (const marker of graph.markers) {
    lines.push(buildMarker(marker, layout))
  }

  lines.push('  </g>')
  lines.push('</svg>')
  return lines.join('\n')
}

function buildGraphStepActions(
  step: InteractiveLesson['steps'][number],
  stepIndex: number,
  seenPlots: Set<string>,
  seenMarkers: Set<string>,
  availablePlotLabels: Set<string>,
): GuidedExplanationAction[] {
  const actions: GuidedExplanationAction[] = []

  // Draw plot curves new to this step, plus fade-in their optional labels.
  if (step.highlightPlots) {
    for (const rawId of step.highlightPlots) {
      const id = `plot-${safeLabel(rawId)}`
      if (!seenPlots.has(id)) {
        actions.push({ op: 'draw', id })
        seenPlots.add(id)
        const labelId = `${id}-label`
        if (availablePlotLabels.has(labelId)) {
          actions.push({ op: 'show', id: labelId })
        }
      }
    }
  }

  // Fade-in markers new to this step.
  if (step.highlightMarkers) {
    for (const rawId of step.highlightMarkers) {
      const id = `marker-${safeLabel(rawId)}`
      if (!seenMarkers.has(id)) {
        actions.push({ op: 'show', id })
        seenMarkers.add(id)
      }
    }
  }

  actions.push({ op: 'highlightRow', rowId: `row-${stepIndex + 1}` })

  return actions
}

// ---------------------------------------------------------------------------
// Number-line scene — inequalities, intervals, set ops on ℝ
// ---------------------------------------------------------------------------

const NUMBER_LINE_SCENE_WIDTH = 600
const NUMBER_LINE_SCENE_HEIGHT = 180
const NUMBER_LINE_PADDING = 40
const NUMBER_LINE_BASELINE_Y = 120
/** Vertical offset between stacked intervals so they don't overlap. */
const INTERVAL_LANE_GAP = 14

function numberLineXToSvg(value: number, range: [number, number]): number {
  const [min, max] = range
  const span = max - min || 1
  const plotWidth = NUMBER_LINE_SCENE_WIDTH - 2 * NUMBER_LINE_PADDING
  return NUMBER_LINE_PADDING + ((value - min) / span) * plotWidth
}

function buildNumberLineAxis(range: [number, number], step: number): string[] {
  const lines: string[] = []
  const y = NUMBER_LINE_BASELINE_Y
  const [min, max] = range
  const leftX = NUMBER_LINE_PADDING - 8
  const rightX = NUMBER_LINE_SCENE_WIDTH - NUMBER_LINE_PADDING + 8
  // Main axis with arrowheads at both ends
  lines.push(
    `    <line x1="${leftX}" y1="${y}" x2="${rightX}" y2="${y}" stroke="currentColor" stroke-width="1.5" opacity="0.75" />`,
  )
  // Arrowheads as small triangles
  lines.push(
    `    <polygon points="${leftX - 6},${y} ${leftX},${y - 5} ${leftX},${y + 5}" fill="currentColor" opacity="0.75" />`,
  )
  lines.push(
    `    <polygon points="${rightX + 6},${y} ${rightX},${y - 5} ${rightX},${y + 5}" fill="currentColor" opacity="0.75" />`,
  )
  // Ticks + labels
  for (const tick of axisTicks(min, max, step)) {
    const x = numberLineXToSvg(tick, range)
    lines.push(
      `    <line x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}" stroke="currentColor" stroke-width="1" opacity="0.6" />`,
    )
    lines.push(
      `    <text x="${x}" y="${y + 20}" text-anchor="middle" font-size="11" fill="currentColor" opacity="0.7">${formatTick(tick)}</text>`,
    )
  }
  return lines
}

function buildMark(
  mark: NumberLineMark,
  range: [number, number],
  seenValuesByLane: Map<number, number>,
): string {
  const cx = numberLineXToSvg(mark.value, range)
  const cy = NUMBER_LINE_BASELINE_Y
  const color = safeColor(mark.color)
  const filled = mark.inclusion !== 'open'
  const id = `mark-${safeLabel(mark.id)}`
  // Offset label above the dot to avoid stomping the axis number
  const labelY = cy - 14
  const labelText = mark.label
    ? `<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="12" font-weight="600" fill="${color}">${escapeXml(mark.label)}</text>`
    : ''
  // Open (hollow) inclusion = scene-background fill so it reads correctly in
  // both light and dark themes. CSS class wins over absent `fill` attribute.
  const fillAttr = filled ? `fill="${color}"` : `class="ge-bg-fill"`
  const result = `    <g id="${id}" class="ge-fade-element"><circle cx="${cx}" cy="${cy}" r="5" ${fillAttr} stroke="${color}" stroke-width="2" />${labelText}</g>`
  // Track which lane each mark occupies so intervals can dodge them — simple
  // approximation; for now always lane 0.
  seenValuesByLane.set(mark.value, 0)
  return result
}

function intervalLane(
  intervalIndex: number,
  usedLanes: number[],
  spans: Array<[number, number]>,
): number {
  // Find the lowest lane that doesn't overlap with any previously-placed
  // interval on the same lane. Intervals overlap if their spans share any x.
  const [newFrom, newTo] = spans[intervalIndex]
  for (let lane = 0; lane < 8; lane++) {
    let collides = false
    for (let prev = 0; prev < intervalIndex; prev++) {
      if (usedLanes[prev] !== lane) continue
      const [pf, pt] = spans[prev]
      const overlap = Math.max(pf, newFrom) <= Math.min(pt, newTo)
      if (overlap) {
        collides = true
        break
      }
    }
    if (!collides) return lane
  }
  // Past 8 overlapping intervals we run out of vertical room and collapse
  // back to lane 0 — those intervals will visually stack on top of each
  // other. Typical lessons have 1–3 intervals so this should never hit;
  // if it does, the scene has more than the renderer is designed for.
  if (typeof console !== 'undefined') {
    console.warn(
      '[interactive-lesson] Number-line interval lanes exhausted; collapsing onto lane 0',
      { intervalIndex, totalIntervals: spans.length },
    )
  }
  return 0
}

function intervalSpan(iv: NumberLineInterval): [number, number] {
  return iv.from <= iv.to ? [iv.from, iv.to] : [iv.to, iv.from]
}

function buildInterval(iv: NumberLineInterval, range: [number, number], lane: number): string[] {
  const color = safeColor(iv.color)
  const y = NUMBER_LINE_BASELINE_Y - 22 - lane * INTERVAL_LANE_GAP
  const xFrom = numberLineXToSvg(iv.from, range)
  const xTo = numberLineXToSvg(iv.to, range)
  const lines: string[] = []
  const id = `interval-${safeLabel(iv.id)}`
  // Draw the main segment (animated via ge-draw-path stroke-dashoffset).
  lines.push(
    `    <line id="${id}" class="ge-draw-path" x1="${xFrom}" y1="${y}" x2="${xTo}" y2="${y}" stroke="${color}" stroke-width="5" stroke-linecap="round" />`,
  )
  // Endpoint decorations — drawn static, appear alongside the line draw.
  const endGroupId = `${id}-ends`
  const endpoints: string[] = []
  if (iv.fromInclusion === 'unbounded') {
    // Left arrow
    endpoints.push(
      `<polygon points="${xFrom - 10},${y} ${xFrom},${y - 5} ${xFrom},${y + 5}" fill="${color}" />`,
    )
  } else {
    const filled = iv.fromInclusion === 'closed'
    // Open (hollow) endpoint reads as "value excluded"; the fill matches the
    // scene background via CSS class so it inverts cleanly in dark mode.
    const fillAttr = filled ? `fill="${color}"` : `class="ge-bg-fill"`
    endpoints.push(
      `<circle cx="${xFrom}" cy="${y}" r="5" ${fillAttr} stroke="${color}" stroke-width="2" />`,
    )
  }
  if (iv.toInclusion === 'unbounded') {
    endpoints.push(
      `<polygon points="${xTo + 10},${y} ${xTo},${y - 5} ${xTo},${y + 5}" fill="${color}" />`,
    )
  } else {
    const filled = iv.toInclusion === 'closed'
    const fillAttr = filled ? `fill="${color}"` : `class="ge-bg-fill"`
    endpoints.push(
      `<circle cx="${xTo}" cy="${y}" r="5" ${fillAttr} stroke="${color}" stroke-width="2" />`,
    )
  }
  lines.push(`    <g id="${endGroupId}" class="ge-fade-element">${endpoints.join('')}</g>`)
  // Optional label — rendered above the midpoint
  if (iv.label) {
    const mid = (xFrom + xTo) / 2
    lines.push(
      `    <text id="${id}-label" class="ge-fade-element" x="${mid}" y="${y - 8}" text-anchor="middle" font-size="12" font-weight="600" fill="${color}">${escapeXml(iv.label)}</text>`,
    )
  }
  return lines
}

function buildNumberLineSvg(data: NumberLineData): string {
  const range = data.range
  const step = data.step ?? 1
  const lines: string[] = []
  lines.push(
    `<svg viewBox="0 0 ${NUMBER_LINE_SCENE_WIDTH} ${NUMBER_LINE_SCENE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
  )
  lines.push('  <g font-family="sans-serif" fill="currentColor">')

  lines.push(...buildNumberLineAxis(range, step))

  // Pre-compute a lane per interval so overlapping intervals stack cleanly.
  const spans = data.intervals.map(intervalSpan)
  const lanes: number[] = []
  for (let i = 0; i < data.intervals.length; i++) {
    lanes.push(intervalLane(i, lanes, spans))
  }

  for (let i = 0; i < data.intervals.length; i++) {
    lines.push(...buildInterval(data.intervals[i], range, lanes[i]))
  }

  const seenValuesByLane = new Map<number, number>()
  for (const mark of data.marks) {
    lines.push(buildMark(mark, range, seenValuesByLane))
  }

  lines.push('  </g>')
  lines.push('</svg>')
  return lines.join('\n')
}

function buildNumberLineStepActions(
  step: InteractiveLesson['steps'][number],
  stepIndex: number,
  seenMarks: Set<string>,
  seenIntervals: Set<string>,
  intervalsWithLabels: Set<string>,
): GuidedExplanationAction[] {
  const actions: GuidedExplanationAction[] = []

  if (step.highlightIntervals) {
    for (const rawId of step.highlightIntervals) {
      const id = `interval-${safeLabel(rawId)}`
      if (!seenIntervals.has(id)) {
        actions.push({ op: 'draw', id })
        actions.push({ op: 'show', id: `${id}-ends` })
        if (intervalsWithLabels.has(id)) actions.push({ op: 'show', id: `${id}-label` })
        seenIntervals.add(id)
      }
    }
  }

  if (step.highlightMarks) {
    for (const rawId of step.highlightMarks) {
      const id = `mark-${safeLabel(rawId)}`
      if (!seenMarks.has(id)) {
        actions.push({ op: 'show', id })
        seenMarks.add(id)
      }
    }
  }

  actions.push({ op: 'highlightRow', rowId: `row-${stepIndex + 1}` })
  return actions
}

// ---------------------------------------------------------------------------
// Equation scene (used when the lesson has no geometric figure)
// ---------------------------------------------------------------------------

const EQUATION_SCENE_WIDTH = 600
const EQUATION_SCENE_HEIGHT = 300
const EQUATION_FONT_MAX = 32
const EQUATION_FONT_MIN = 14

/** Rough character-budget heuristic so long claims still fit in the scene. */
function equationFontSize(claim: string): number {
  const len = Math.max(claim.length, 10)
  // 800 empirically gives ~30px for a typical 25-char claim and scales down
  // to the floor for very long ones.
  return Math.max(EQUATION_FONT_MIN, Math.min(EQUATION_FONT_MAX, Math.floor(800 / len)))
}

function buildEquationSvg(steps: InteractiveLesson['steps']): string {
  const lines: string[] = []
  lines.push(
    `<svg viewBox="0 0 ${EQUATION_SCENE_WIDTH} ${EQUATION_SCENE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`,
  )
  lines.push('  <g font-family="sans-serif" font-weight="500" fill="currentColor">')

  steps.forEach((step, i) => {
    const fontSize = equationFontSize(step.claim)
    lines.push(
      `    <text id="eq-${i + 1}" class="ge-fade-element" x="${EQUATION_SCENE_WIDTH / 2}" y="${EQUATION_SCENE_HEIGHT / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}">${escapeXml(step.claim)}</text>`,
    )
  })

  lines.push('  </g>')
  lines.push('</svg>')
  return lines.join('\n')
}

function buildEquationStepActions(stepIndex: number): GuidedExplanationAction[] {
  const actions: GuidedExplanationAction[] = []
  // Fade the previous step's equation out so only the current one is visible.
  if (stepIndex > 0) {
    actions.push({ op: 'hide', id: `eq-${stepIndex}` })
  }
  actions.push({ op: 'show', id: `eq-${stepIndex + 1}` })
  actions.push({ op: 'highlightRow', rowId: `row-${stepIndex + 1}` })
  return actions
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

function hasGeometricFigure(geometry: GeometryData): boolean {
  return geometry.points.length > 0 || geometry.segments.length > 0
}

function hasGraphContent(graph: GraphData | undefined): graph is GraphData {
  return !!graph && graph.plots.length > 0
}

function hasNumberLineContent(
  numberLine: NumberLineData | undefined,
): numberLine is NumberLineData {
  return !!numberLine && (numberLine.intervals.length > 0 || numberLine.marks.length > 0)
}

type SceneKind = 'graph' | 'numberLine' | 'geometry' | 'equation'

/**
 * Pick which scene the player should render. Order: graph > numberLine >
 * geometry > equation. The schema lets the model populate more than one
 * (e.g. coordinate-geometry that has both axes-with-plots AND labeled
 * vertices), but the renderer only shows one — the others are silently
 * dropped, which can hide content. Log a warning so the gap is observable
 * server-side; the prompt instructs the model to populate exactly one, and
 * a hit here means it didn't follow that instruction.
 */
function pickSceneKind(lesson: InteractiveLesson): SceneKind {
  const haveGraph = hasGraphContent(lesson.graph)
  const haveNumberLine = hasNumberLineContent(lesson.numberLine)
  const haveGeometry = hasGeometricFigure(lesson.geometry)

  const populated = [
    haveGraph && 'graph',
    haveNumberLine && 'numberLine',
    haveGeometry && 'geometry',
  ].filter(Boolean) as SceneKind[]

  if (populated.length > 1 && typeof console !== 'undefined') {
    console.warn('[interactive-lesson] Multiple scene kinds populated; rendering only the first.', {
      populated,
      title: lesson.title,
    })
  }

  if (haveGraph) return 'graph'
  if (haveNumberLine) return 'numberLine'
  if (haveGeometry) return 'geometry'
  return 'equation'
}

export function interactiveLessonToGuidedExplanation(
  lesson: InteractiveLesson,
): GuidedExplanationV1 {
  const direction = lesson.locale === 'he' ? 'rtl' : 'ltr'
  const sceneKind = pickSceneKind(lesson)

  let scene: GuidedExplanationV1['scene']
  if (sceneKind === 'graph' && lesson.graph) {
    scene = {
      svg: buildGraphSvg(lesson.graph),
      viewBox: `0 0 ${GRAPH_SCENE_WIDTH} ${GRAPH_SCENE_HEIGHT}`,
    }
  } else if (sceneKind === 'numberLine' && lesson.numberLine) {
    scene = {
      svg: buildNumberLineSvg(lesson.numberLine),
      viewBox: `0 0 ${NUMBER_LINE_SCENE_WIDTH} ${NUMBER_LINE_SCENE_HEIGHT}`,
    }
  } else if (sceneKind === 'geometry') {
    scene = {
      svg: buildGeometrySvg(lesson.geometry),
      viewBox: `0 0 ${lesson.geometry.width} ${lesson.geometry.height}`,
    }
  } else {
    scene = {
      svg: buildEquationSvg(lesson.steps),
      viewBox: `0 0 ${EQUATION_SCENE_WIDTH} ${EQUATION_SCENE_HEIGHT}`,
    }
  }

  const seenSegments = new Set<string>()
  const seenPoints = new Set<string>()
  const seenPlots = new Set<string>()
  const seenMarkers = new Set<string>()
  const seenIntervals = new Set<string>()
  const seenMarks = new Set<string>()
  const plotLabelIds = new Set<string>(
    (lesson.graph?.plots ?? [])
      .filter((p) => !!p.label)
      .map((p) => `plot-${safeLabel(p.id)}-label`),
  )
  const intervalsWithLabels = new Set<string>(
    (lesson.numberLine?.intervals ?? [])
      .filter((iv) => !!iv.label)
      .map((iv) => `interval-${safeLabel(iv.id)}`),
  )

  const steps = lesson.steps.map((step, i) => {
    let actions: GuidedExplanationAction[]
    if (sceneKind === 'graph') {
      actions = buildGraphStepActions(step, i, seenPlots, seenMarkers, plotLabelIds)
    } else if (sceneKind === 'numberLine') {
      actions = buildNumberLineStepActions(step, i, seenMarks, seenIntervals, intervalsWithLabels)
    } else if (sceneKind === 'geometry') {
      actions = buildGeometryStepActions(step, i, seenSegments, seenPoints)
    } else {
      actions = buildEquationStepActions(i)
    }
    return {
      id: `step-${step.id}`,
      title: step.title,
      actions,
      narrate: {
        display: step.narration,
        audioBase64: step.audioBase64,
      },
    }
  })

  return {
    version: 'guided-explanation/v1',
    title: lesson.title,
    direction,
    locale: lesson.locale,
    scene,
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
