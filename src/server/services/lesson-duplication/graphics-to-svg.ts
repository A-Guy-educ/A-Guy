/**
 * @fileType utility
 * @domain lessons
 * @pattern lesson-export
 * @ai-summary Renders GeometrySpecV1 and AxisSpecV1 to SVG markup strings for lesson export.
 */

import { GeometrySpecV1Schema } from '@/infra/contracts/graphics/geometry.v1'
import { AxisSpecV1Schema } from '@/infra/contracts/graphics/axis.v1'
import { parse } from 'mathjs'

// -------------------------------------------
// Escape XML special characters
// -------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// -------------------------------------------
// Color defaults (matching client renderers)
// -------------------------------------------

const DEFAULT_STROKE = '#000000'
const DEFAULT_FILL = 'none'

// -------------------------------------------
// GeometrySpecV1 → SVG
// -------------------------------------------

/**
 * Evaluate a math expression safely using mathjs.
 * Returns null on parse/eval failure.
 */
function safeMathEval(expr: string, x: number): number | null {
  try {
    const normalized = expr.toLowerCase().replace(/\s+/g, '')
    const compiled = parse(normalized).compile()
    const scope = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      sqrt: Math.sqrt,
      abs: Math.abs,
      log: Math.log,
      log10: Math.log10,
      exp: Math.exp,
      pow: Math.pow,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      PI: Math.PI,
      E: Math.E,
      x,
    }
    const result = compiled.evaluate(scope)
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

/**
 * Label position → pixel offset [dx, dy].
 */
function labelOffset(pos?: string): [number, number] {
  const d = 15
  const map: Record<string, [number, number]> = {
    tl: [-d, d],
    t: [0, d],
    tr: [d, d],
    l: [-d, 0],
    r: [d, 0],
    bl: [-d, -d],
    b: [0, -d],
    br: [d, -d],
  }
  return map[pos || 'r'] || [d, 0]
}

/**
 * Convert a GeometrySpecV1 to a pure SVG string.
 * Validates input with Zod; returns empty string on failure.
 */
export function geometrySpecToSvg(spec: unknown): string {
  const parsed = GeometrySpecV1Schema.safeParse(spec)
  if (!parsed.success) return ''

  const { canvas, elements } = parsed.data
  const { width, height } = canvas
  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  )

  // Background
  if (canvas.background) {
    parts.push(`<rect width="100%" height="100%" fill="${escapeXml(canvas.background)}"/>`)
  }

  // Grid
  if (canvas.grid) {
    parts.push(
      `<defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e0e0e0" stroke-width="0.5"/></pattern></defs>`,
    )
    parts.push(`<rect width="100%" height="100%" fill="url(#grid)"/>`)
  }

  // Axis
  if (canvas.axis) {
    parts.push(
      `<line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="${DEFAULT_STROKE}" stroke-width="1"/>`,
    )
    parts.push(
      `<line x1="${width / 2}" y1="0" x2="${width / 2}" y2="${height}" stroke="${DEFAULT_STROKE}" stroke-width="1"/>`,
    )
  }

  // Points
  for (const point of elements.points || []) {
    const cx = point.x
    const cy = height - point.y // Flip Y for SVG
    const color = point.color || DEFAULT_STROKE
    const size = point.size || 4
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${size}" fill="${escapeXml(color)}" stroke="${escapeXml(color)}"/>`,
    )
    if (point.name) {
      const [dx, dy] = labelOffset(point.position)
      parts.push(
        `<text x="${cx + dx}" y="${cy + dy}" font-size="${point.fontSize ?? 12}" fill="${escapeXml(color)}" font-family="Times New Roman">${escapeXml(point.name)}</text>`,
      )
    }
  }

  // Lines
  for (const line of elements.lines || []) {
    const fromPt = elements.points.find((p) => p.name === line.from)
    const toPt = elements.points.find((p) => p.name === line.to)
    if (!fromPt || !toPt) continue

    const x1 = fromPt.x
    const y1 = height - fromPt.y
    const x2 = toPt.x
    const y2 = height - toPt.y
    const color = line.color || DEFAULT_STROKE
    const dash = line.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeXml(color)}" stroke-width="${line.thickness ?? 2}" ${dash}/>`,
    )
    if (line.label?.value) {
      const midX = (x1 + x2) / 2
      const midY = (y1 + y2) / 2
      parts.push(
        `<text x="${midX}" y="${midY - 5}" font-size="${line.label.fontSize ?? 10}" fill="${escapeXml(color)}" text-anchor="middle" font-family="Times New Roman">${escapeXml(line.label.value)}</text>`,
      )
    }
  }

  // Circles
  for (const circle of elements.circles || []) {
    const center = elements.points.find((p) => p.name === circle.center)
    if (!center) continue

    const cx = center.x
    const cy = height - center.y
    const color = circle.color || DEFAULT_STROKE
    const dash = circle.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''

    if (circle.through) {
      const through = elements.points.find((p) => p.name === circle.through)
      if (through) {
        const radius = Math.sqrt(
          Math.pow(through.x - center.x, 2) + Math.pow(through.y - center.y, 2),
        )
        parts.push(
          `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${DEFAULT_FILL}" stroke="${escapeXml(color)}" stroke-width="2" ${dash}/>`,
        )
      }
    } else if (circle.radius) {
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${circle.radius}" fill="${DEFAULT_FILL}" stroke="${escapeXml(color)}" stroke-width="2" ${dash}/>`,
      )
    }
  }

  // Angles
  for (const angle of elements.angles || []) {
    const centerPt = elements.points.find((p) => p.name === angle.center)
    const ray1Pt = elements.points.find((p) => p.name === angle.ray1)
    const ray2Pt = elements.points.find((p) => p.name === angle.ray2)
    if (!centerPt || !ray1Pt || !ray2Pt) continue

    const cx = centerPt.x
    const cy = height - centerPt.y
    const color = angle.color || DEFAULT_STROKE
    const radius = angle.arcRadius ?? 1

    if (angle.style === 'square') {
      // Right-angle marker: small square at the vertex
      const r = radius * 10
      parts.push(
        `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${escapeXml(color)}" stroke="none"/>`,
      )
    } else {
      // Arc
      const x1 = ray1Pt.x - centerPt.x
      const y1 = ray1Pt.y - centerPt.y
      const x2 = ray2Pt.x - centerPt.x
      const y2 = ray2Pt.y - centerPt.y
      const angle1 = Math.atan2(y1, x1)
      const angle2 = Math.atan2(y2, x2)
      const arcRadius = radius * 20

      const x1a = cx + arcRadius * Math.cos(angle1)
      const y1a = cy - arcRadius * Math.sin(angle1)
      const x2a = cx + arcRadius * Math.cos(angle2)
      const y2a = cy - arcRadius * Math.sin(angle2)
      const largeArc = Math.abs(angle2 - angle1) > Math.PI ? 1 : 0
      const sweep = angle2 > angle1 ? 1 : 0

      parts.push(
        `<path d="M ${x1a} ${y1a} A ${arcRadius} ${arcRadius} 0 ${largeArc} ${sweep} ${x2a} ${y2a}" fill="none" stroke="${escapeXml(color)}" stroke-width="1.5"/>`,
      )
    }

    if (angle.label?.value) {
      const labelAngle =
        Math.atan2(ray2Pt.y - centerPt.y, ray2Pt.x - centerPt.x) +
        Math.atan2(ray1Pt.y - centerPt.y, ray1Pt.x - centerPt.x)
      const labelX = cx + (radius * 25 + 15) * Math.cos(labelAngle / 2)
      const labelY = cy - (radius * 25 + 15) * Math.sin(labelAngle / 2)
      parts.push(
        `<text x="${labelX}" y="${labelY}" font-size="${angle.label.fontSize ?? 10}" fill="${escapeXml(color)}" text-anchor="middle" font-family="Times New Roman">${escapeXml(angle.label.value)}</text>`,
      )
    }
  }

  // Vectors (arrows)
  for (const vector of elements.vectors || []) {
    const fromPt = elements.points.find((p) => p.name === vector.from)
    const toPt = elements.points.find((p) => p.name === vector.to)
    if (!fromPt || !toPt) continue

    const x1 = fromPt.x
    const y1 = height - fromPt.y
    const x2 = toPt.x
    const y2 = height - toPt.y
    const color = vector.color || DEFAULT_STROKE
    const dash = vector.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''

    // Draw arrow line
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeXml(color)}" stroke-width="${vector.thickness ?? 2}" ${dash}/>`,
    )
    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const headLen = 10
    parts.push(
      `<polygon points="${x2},${y2} ${x2 - headLen * Math.cos(angle - Math.PI / 6)},${y2 - headLen * Math.sin(angle - Math.PI / 6)} ${x2 - headLen * Math.cos(angle + Math.PI / 6)},${y2 - headLen * Math.sin(angle + Math.PI / 6)}" fill="${escapeXml(color)}"/>`,
    )
  }

  // Areas (polygons with shading)
  for (const area of elements.areas || []) {
    const pts = area.polygon
      .map((name) => elements.points.find((p) => p.name === name))
      .filter(Boolean) as Array<{ x: number; y: number }>
    if (pts.length < 3) continue

    const pointsStr = pts.map((p) => `${p.x},${height - p.y}`).join(' ')
    const color = area.color || '#888888'
    const fillOpacity = area.style === 'hatch' ? 0.3 : 0.5
    parts.push(
      `<polygon points="${pointsStr}" fill="${escapeXml(color)}" fill-opacity="${fillOpacity}" stroke="none"/>`,
    )
  }

  // Rectangles
  for (const rect of elements.rectangles || []) {
    const pts = rect.points
      .map((name) => elements.points.find((p) => p.name === name))
      .filter(Boolean) as Array<{ x: number; y: number }>
    if (pts.length !== 4) continue

    const [p0, p1, p2, p3] = pts.map((p) => ({ x: p.x, y: height - p.y }))
    const pointsStr = `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`
    const color = rect.color || DEFAULT_STROKE
    const fill = rect.fill || DEFAULT_FILL
    const dash = rect.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
    const fillOpacity = fill === DEFAULT_FILL ? 0 : 0.3

    parts.push(
      `<polygon points="${pointsStr}" fill="${escapeXml(fill)}" fill-opacity="${fillOpacity}" stroke="${escapeXml(color)}" stroke-width="${rect.thickness ?? 2}" ${dash}/>`,
    )
  }

  // Triangles
  for (const tri of elements.triangles || []) {
    const pts = tri.points
      .map((name) => elements.points.find((p) => p.name === name))
      .filter(Boolean) as Array<{ x: number; y: number }>
    if (pts.length !== 3) continue

    const [p0, p1, p2] = pts.map((p) => ({ x: p.x, y: height - p.y }))
    const pointsStr = `${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`
    const color = tri.color || DEFAULT_STROKE
    const fill = tri.fill || DEFAULT_FILL
    const dash = tri.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
    const fillOpacity = fill === DEFAULT_FILL ? 0 : 0.3

    parts.push(
      `<polygon points="${pointsStr}" fill="${escapeXml(fill)}" fill-opacity="${fillOpacity}" stroke="${escapeXml(color)}" stroke-width="${tri.thickness ?? 2}" ${dash}/>`,
    )
  }

  // Texts
  for (const text of elements.texts || []) {
    let x = text.place?.x ?? 0
    let y = height - (text.place?.y ?? 0)

    if (text.on?.from && text.on?.to) {
      const from = elements.points.find((p) => p.name === text.on?.from)
      const to = elements.points.find((p) => p.name === text.on?.to)
      if (from && to) {
        x = (from.x + to.x) / 2
        y = height - (from.y + to.y) / 2
      }
    }

    const color = text.color || DEFAULT_STROKE
    const fontSize = text.sizeScale !== undefined ? text.sizeScale * 2 : text.fontSize || 14

    parts.push(
      `<text x="${x}" y="${y}" font-size="${fontSize}" fill="${escapeXml(color)}" text-anchor="middle" font-family="Times New Roman">${escapeXml(text.value)}</text>`,
    )
  }

  // Equal segment markers
  for (const group of elements.equalSegments || []) {
    for (const seg of group) {
      const fromPt = elements.points.find((p) => p.name === seg.from)
      const toPt = elements.points.find((p) => p.name === seg.to)
      if (!fromPt || !toPt) continue

      const x1 = fromPt.x
      const y1 = height - fromPt.y
      const x2 = toPt.x
      const y2 = height - toPt.y
      const midX = (x1 + x2) / 2
      const midY = (y1 + y2) / 2
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const perpX = (-dy / len) * 6
      const perpY = (dx / len) * 6

      // Draw double-tick mark
      parts.push(
        `<line x1="${midX - perpX}" y1="${midY - perpY}" x2="${midX + perpX}" y2="${midY + perpY}" stroke="${DEFAULT_STROKE}" stroke-width="1"/>`,
      )
    }
  }

  // Tangents
  for (const tangent of elements.tangents || []) {
    const color = tangent.color || DEFAULT_STROKE
    const dash = tangent.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''

    if (tangent.type === 'at_point' && tangent.point && tangent.circle) {
      const circle = elements.circles?.find((c) => c.center === tangent.circle)
      const point = elements.points.find((p) => p.name === tangent.point)
      if (circle && point) {
        // Tangent at a point on a circle
        const cx = point.x
        const cy = height - point.y
        // Perpendicular line through point (simplified)
        const tangentLen = 30
        parts.push(
          `<line x1="${cx - tangentLen}" y1="${cy - tangentLen}" x2="${cx + tangentLen}" y2="${cy + tangentLen}" stroke="${escapeXml(color)}" stroke-width="1.5" ${dash}/>`,
        )
      }
    } else if (tangent.type === 'external_point' && tangent.point && tangent.circle) {
      const circle = elements.circles?.find((c) => c.center === tangent.circle)
      const point = elements.points.find((p) => p.name === tangent.point)
      if (circle && point) {
        // External tangent from a point outside the circle (simplified: just draw line from point to circle)
        const x1 = point.x
        const y1 = height - point.y
        const cx = elements.points.find((p) => p.name === circle.center)?.x ?? 0
        const cyC = height - (elements.points.find((p) => p.name === circle.center)?.y ?? 0)
        const r = circle.radius ?? 1
        // Draw approximate tangent line
        const angle = Math.atan2(y1 - cyC, x1 - cx)
        const x2 = cx + r * Math.cos(angle)
        const y2 = cyC + r * Math.sin(angle)
        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeXml(color)}" stroke-width="1.5" ${dash}/>`,
        )
      }
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// -------------------------------------------
// AxisSpecV1 → SVG
// -------------------------------------------

/**
 * Convert an AxisSpecV1 to a pure SVG string.
 * Uses mathjs to evaluate function plots over the visible range (~200 samples).
 * Validates input with Zod; returns empty string on failure.
 */
export function axisSpecToSvg(spec: unknown): string {
  const parsed = AxisSpecV1Schema.safeParse(spec)
  if (!parsed.success) return ''

  const { viewportMode, viewport, units: _units } = parsed.data
  const v = viewport || {}

  // Resolve viewport bounds
  let xMin: number, xMax: number, yMin: number, yMax: number

  if (
    viewportMode === 'manual' &&
    v.xMin !== undefined &&
    v.xMax !== undefined &&
    v.yMin !== undefined &&
    v.yMax !== undefined
  ) {
    xMin = v.xMin
    xMax = v.xMax
    yMin = v.yMin
    yMax = v.yMax
  } else {
    // Auto viewport: calculate from content
    xMin = v.xMin ?? -10
    xMax = v.xMax ?? 10
    yMin = v.yMin ?? -10
    yMax = v.yMax ?? 10

    // Expand to fit points
    for (const pt of parsed.data.elements.points || []) {
      xMin = Math.min(xMin, pt.x)
      xMax = Math.max(xMax, pt.x)
      yMin = Math.min(yMin, pt.y)
      yMax = Math.max(yMax, pt.y)
    }

    // Expand to fit graphs (sample)
    const sampleCount = 20
    const sampleRange = Math.max(Math.abs(xMin), Math.abs(xMax), 10)
    for (const graph of parsed.data.elements.graphs || []) {
      for (let i = 0; i <= sampleCount; i++) {
        const x = -sampleRange + (i / sampleCount) * (sampleRange * 2)
        const y = safeMathEval(graph.fn, x)
        if (y !== null) {
          xMin = Math.min(xMin, x)
          xMax = Math.max(xMax, x)
          yMin = Math.min(yMin, y)
          yMax = Math.max(yMax, y)
        }
      }
    }

    // Add 10% padding
    const xPad = Math.max(1, (xMax - xMin) * 0.1)
    const yPad = Math.max(1, (yMax - yMin) * 0.1)
    xMin -= xPad
    xMax += xPad
    yMin -= yPad
    yMax += yPad
  }

  const width = 600
  const height = 400

  const scaleX = (x: number) => ((x - xMin) / (xMax - xMin)) * width
  const scaleY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  )

  // Grid
  if (parsed.data.grid.enabled) {
    const gridColor = parsed.data.grid.color || '#e0e0e0'
    for (let x = 0; x <= width; x += 20) {
      parts.push(
        `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="${escapeXml(gridColor)}" stroke-width="0.5"/>`,
      )
    }
    for (let y = 0; y <= height; y += 20) {
      parts.push(
        `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="${escapeXml(gridColor)}" stroke-width="0.5"/>`,
      )
    }
  }

  // Axes
  const originX = scaleX(parsed.data.axes.origin?.x ?? 0)
  const originY = scaleY(parsed.data.axes.origin?.y ?? 0)
  const axisColor = parsed.data.axes.axisColor || DEFAULT_STROKE

  parts.push(
    `<line x1="0" y1="${originY}" x2="${width}" y2="${originY}" stroke="${escapeXml(axisColor)}" stroke-width="1"/>`,
  )
  parts.push(
    `<line x1="${originX}" y1="0" x2="${originX}" y2="${height}" stroke="${escapeXml(axisColor)}" stroke-width="1"/>`,
  )

  // Arrows at axis ends
  parts.push(
    `<polygon points="${width - 5},${originY - 3} ${width},${originY} ${width - 5},${originY + 3}" fill="${escapeXml(axisColor)}"/>`,
  )
  parts.push(
    `<polygon points="${originX - 3},5 ${originX},0 ${originX + 3},5" fill="${escapeXml(axisColor)}"/>`,
  )

  // Axis labels
  if (parsed.data.axes.showLabels) {
    parts.push(
      `<text x="${width - 15}" y="${originY - 8}" font-size="12" fill="${escapeXml(parsed.data.axes.labelColor || DEFAULT_STROKE)}" font-family="Times New Roman">${escapeXml(parsed.data.axes.labels?.y ?? 'y')}</text>`,
    )
    parts.push(
      `<text x="${originX + 8}" y="15" font-size="12" fill="${escapeXml(parsed.data.axes.labelColor || DEFAULT_STROKE)}" font-family="Times New Roman">${escapeXml(parsed.data.axes.labels?.x ?? 'x')}</text>`,
    )
  }

  // Vertical asymptotes
  for (const xVal of parsed.data.elements.asymptotesVertical || []) {
    const sx = scaleX(xVal)
    parts.push(
      `<line x1="${sx}" y1="0" x2="${sx}" y2="${height}" stroke="#999999" stroke-width="1" stroke-dasharray="4,4"/>`,
    )
  }

  // Horizontal asymptotes
  for (const yVal of parsed.data.elements.asymptotesHorizontal || []) {
    const sy = scaleY(yVal)
    parts.push(
      `<line x1="0" y1="${sy}" x2="${width}" y2="${sy}" stroke="#999999" stroke-width="1" stroke-dasharray="4,4"/>`,
    )
  }

  // Graphs — ~200 samples for smooth curves
  for (const graph of parsed.data.elements.graphs || []) {
    const color = graph.color || '#0066cc'
    const strokeWidth = graph.thickness || 2
    const dash = graph.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''

    const rangeFrom = graph.range?.fromX ?? xMin
    const rangeTo = graph.range?.toX ?? xMax
    const steps = 200
    const points: string[] = []

    for (let i = 0; i <= steps; i++) {
      const x = rangeFrom + (i / steps) * (rangeTo - rangeFrom)
      const y = safeMathEval(graph.fn, x)
      if (y !== null && y >= yMin - 50 && y <= yMax + 50) {
        points.push(`${scaleX(x).toFixed(2)},${scaleY(y).toFixed(2)}`)
      }
    }

    if (points.length > 1) {
      parts.push(
        `<polyline points="${points.join(' ')}" fill="none" stroke="${escapeXml(color)}" stroke-width="${strokeWidth}" ${dash}/>`,
      )
    }

    // Paint areas under/above graph
    if (graph.paint?.underGraph) {
      for (const range of graph.paint.underGraph) {
        const fillColor = range.fillColor || color
        const areaPoints: string[] = []
        const paintSteps = 100
        for (let i = 0; i <= paintSteps; i++) {
          const x = range.fromX + (i / paintSteps) * (range.toX - range.fromX)
          const y = safeMathEval(graph.fn, x)
          if (y !== null) {
            areaPoints.push(`${scaleX(x).toFixed(2)},${scaleY(y).toFixed(2)}`)
          }
        }
        // Close the area at the bottom
        areaPoints.push(`${scaleX(range.toX).toFixed(2)},${scaleY(yMin).toFixed(2)}`)
        areaPoints.push(`${scaleX(range.fromX).toFixed(2)},${scaleY(yMin).toFixed(2)}`)
        areaPoints.push(
          `${scaleX(range.fromX).toFixed(2)},${scaleY(safeMathEval(graph.fn, range.fromX) ?? yMin).toFixed(2)}`,
        )

        if (areaPoints.length > 2) {
          parts.push(
            `<polygon points="${areaPoints.join(' ')}" fill="${escapeXml(fillColor)}" fill-opacity="0.3" stroke="none"/>`,
          )
        }
      }
    }
  }

  // Paint between graphs
  for (const pb of parsed.data.elements.paintBetweenGraphs || []) {
    const fillColor = pb.fillColor || '#888888'
    const g1 = parsed.data.elements.graphs.find((g) => g.id === pb.firstGraphId)
    const g2 = parsed.data.elements.graphs.find((g) => g.id === pb.secondGraphId)
    if (!g1 || !g2) continue

    const areaPoints: string[] = []
    const steps = 100
    for (let i = 0; i <= steps; i++) {
      const x = pb.fromX + (i / steps) * (pb.toX - pb.fromX)
      const y1 = safeMathEval(g1.fn, x)
      const y2 = safeMathEval(g2.fn, x)
      if (y1 !== null && y2 !== null) {
        areaPoints.push(`${scaleX(x).toFixed(2)},${scaleY(y1).toFixed(2)}`)
      }
    }
    for (let i = steps; i >= 0; i--) {
      const x = pb.fromX + (i / steps) * (pb.toX - pb.fromX)
      const y2 = safeMathEval(g2.fn, x)
      if (y2 !== null) {
        areaPoints.push(`${scaleX(x).toFixed(2)},${scaleY(y2).toFixed(2)}`)
      }
    }

    if (areaPoints.length > 2) {
      parts.push(
        `<polygon points="${areaPoints.join(' ')}" fill="${escapeXml(fillColor)}" fill-opacity="0.3" stroke="none"/>`,
      )
    }
  }

  // Line between points
  for (const line of parsed.data.elements.lineBetweenPoints || []) {
    const color = line.color || DEFAULT_STROKE
    const dash = line.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
    parts.push(
      `<line x1="${scaleX(line.a.x).toFixed(2)}" y1="${scaleY(line.a.y).toFixed(2)}" x2="${scaleX(line.b.x).toFixed(2)}" y2="${scaleY(line.b.y).toFixed(2)}" stroke="${escapeXml(color)}" stroke-width="${line.thickness}" ${dash}/>`,
    )
  }

  // Points
  for (const point of parsed.data.elements.points || []) {
    const cx = scaleX(point.x)
    const cy = scaleY(point.y)
    const color = point.color || DEFAULT_STROKE

    if (point.type === 'floating_text') {
      const labelPos = point.labelPosition || 't'
      const dy = labelPos === 'b' ? 15 : -15
      parts.push(
        `<text x="${cx}" y="${cy + dy}" font-size="14" fill="${escapeXml(color)}" text-anchor="middle" font-family="Times New Roman">${escapeXml(point.label || '')}</text>`,
      )
    } else {
      const fillColor = point.type === 'hole' ? '#ffffff' : color
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="4" fill="${escapeXml(fillColor)}" stroke="${escapeXml(color)}" stroke-width="2"/>`,
      )
      if (point.label) {
        const labelPos = point.labelPosition || 't'
        const dy = labelPos === 'b' ? 15 : -15
        parts.push(
          `<text x="${cx}" y="${cy + dy}" font-size="12" fill="${escapeXml(color)}" text-anchor="middle" font-family="Times New Roman">${escapeXml(point.label)}</text>`,
        )
      }
    }
  }

  // Axis numbers
  if (parsed.data.axes.showNumbers) {
    const step = parsed.data.axes.ticks || 1
    const numColor = parsed.data.axes.numberColor || '#666666'
    for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
      if (Math.abs(x - (parsed.data.axes.origin?.x ?? 0)) < 0.001) continue
      const sx = scaleX(x)
      parts.push(
        `<text x="${sx}" y="${originY + 15}" font-size="10" fill="${escapeXml(numColor)}" text-anchor="middle" font-family="Times New Roman">${x}</text>`,
      )
    }
    for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
      if (Math.abs(y - (parsed.data.axes.origin?.y ?? 0)) < 0.001) continue
      const sy = scaleY(y)
      parts.push(
        `<text x="${originX + 5}" y="${sy}" font-size="10" fill="${escapeXml(numColor)}" text-anchor="start" font-family="Times New Roman">${y}</text>`,
      )
    }
  }

  // Geometric loci
  for (const locus of parsed.data.elements.geometricLoci || []) {
    const color = locus.color || '#990099'
    const dash = locus.style === 'dashed' ? 'stroke-dasharray="5,5"' : ''
    const locusPoints: string[] = []
    const steps = 300
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin)
      const y = safeMathEval(locus.equation, x)
      if (y !== null && y >= yMin - 20 && y <= yMax + 20) {
        locusPoints.push(`${scaleX(x).toFixed(2)},${scaleY(y).toFixed(2)}`)
      }
    }
    if (locusPoints.length > 1) {
      parts.push(
        `<polyline points="${locusPoints.join(' ')}" fill="none" stroke="${escapeXml(color)}" stroke-width="${locus.thickness}" ${dash}/>`,
      )
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// -------------------------------------------
// Multi-axis → SVG
// -------------------------------------------

/**
 * Render a multi-axis block (multiple graphs) as a combined SVG.
 * Graphs are rendered side by side with labels.
 * Validates each axis with Zod; skips invalid axes silently.
 */
export function multiAxisToSvg(graphs: unknown): string {
  if (!Array.isArray(graphs) || graphs.length === 0) return ''

  const validSvgs: string[] = []

  for (const graph of graphs) {
    if (
      graph &&
      typeof graph === 'object' &&
      'axis' in graph &&
      typeof (graph as Record<string, unknown>).axis === 'object'
    ) {
      const svg = axisSpecToSvg((graph as { axis: unknown }).axis)
      if (svg) {
        validSvgs.push(svg)
      }
    }
  }

  if (validSvgs.length === 0) return ''
  if (validSvgs.length === 1) return validSvgs[0]

  // For multiple graphs, concatenate SVGs separated by newlines
  return validSvgs.join('\n')
}
