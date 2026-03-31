/**
 * Parses TikZ coordinate-based geometry into GeometrySpecV1 blocks.
 *
 * Handles:
 * - \coordinate (Name) at (x,y) → points
 * - \draw[thick] (A) -- (B) -- (C) → lines
 * - \draw (M) circle (R) → circles
 * - \fill (A) circle (3pt) node[...] {Label} → visible points with labels
 * - Right angle markers
 */

import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import type { QuestionGeometryBlock } from '@/server/payload/collections/Exercises/types'
import { makeGeometryBlock } from '@/lib/latex-parser/block-generators'

interface ParsedPoint {
  name: string
  x: number
  y: number
}

/** Parse \coordinate (Name) at (x,y); commands */
function parseCoordinates(content: string): ParsedPoint[] {
  const points: ParsedPoint[] = []
  const regex = /\\coordinate\s*\((\w+)\)\s*at\s*\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const name = match[1]
    const coords = match[2].split(',').map((s) => parseFloat(s.trim()))
    if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      points.push({ name, x: coords[0], y: coords[1] })
    }
  }
  return points
}

/**
 * Extract inline coordinates from \draw commands like:
 *   \draw (0,0) node[below]{B} -- (5,0) node[right]{C} -- (6.5,3) node[above]{D} -- cycle;
 * Returns points with names from node labels, and constructs line segments.
 */
function parseInlineDrawCoordinates(content: string): {
  points: ParsedPoint[]
  labels: Map<string, string>
  lines: Array<{ from: string; to: string; style: 'solid' | 'dashed' }>
} {
  const points: ParsedPoint[] = []
  const labels = new Map<string, string>()
  const lines: Array<{ from: string; to: string; style: 'solid' | 'dashed' }> = []
  const seen = new Map<string, string>() // "x,y" → point name

  const drawRegex = /\\draw\s*(?:\[([^\]]*)\])?\s*([^;]+);/gs
  let drawMatch: RegExpExecArray | null
  while ((drawMatch = drawRegex.exec(content)) !== null) {
    const opts = drawMatch[1] || ''
    const path = drawMatch[2]
    const isDashed = opts.includes('dashed')
    const style: 'solid' | 'dashed' = isDashed ? 'dashed' : 'solid'

    // Match (x,y) optionally followed by node[...]{Label}
    const coordRegex =
      /\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)\s*(?:node\s*\[[^\]]*\]\s*(?:\{([^}]*)\})?)?/g
    const segmentPoints: string[] = []
    let coordMatch: RegExpExecArray | null
    while ((coordMatch = coordRegex.exec(path)) !== null) {
      const x = parseFloat(coordMatch[1])
      const y = parseFloat(coordMatch[2])
      const label = coordMatch[3]?.trim()
      const key = `${x},${y}`

      let name: string
      if (seen.has(key)) {
        name = seen.get(key)!
      } else {
        name = label || `_p${points.length}`
        seen.set(key, name)
        points.push({ name, x, y })
        if (label) labels.set(name, label)
      }
      segmentPoints.push(name)
    }

    // Build line segments from consecutive points
    for (let i = 0; i < segmentPoints.length - 1; i++) {
      lines.push({ from: segmentPoints[i], to: segmentPoints[i + 1], style })
    }
    // Handle -- cycle
    if (/--\s*cycle/.test(path) && segmentPoints.length > 2) {
      lines.push({ from: segmentPoints[segmentPoints.length - 1], to: segmentPoints[0], style })
    }
  }

  return { points, labels, lines }
}

/** Parse \draw[...] (A) -- (B) -- (C); line chains */
function parseDrawLines(
  content: string,
  knownPoints: Set<string>,
): Array<{ from: string; to: string; style: 'solid' | 'dashed' }> {
  const lines: Array<{ from: string; to: string; style: 'solid' | 'dashed' }> = []
  // Match \draw[options] (A) -- (B) -- (C) ... ;
  const drawRegex = /\\draw\s*\[([^\]]*)\]\s*([^;]+);/g
  let match: RegExpExecArray | null
  while ((match = drawRegex.exec(content)) !== null) {
    const opts = match[1]
    const path = match[2]
    const isDashed = opts.includes('dashed')
    const style = isDashed ? 'dashed' : ('solid' as const)

    // Extract point references from path like (A) -- (B) -- (C)
    const pointRefs = path.match(/\((\w+)\)/g)
    if (pointRefs && pointRefs.length >= 2) {
      const names = pointRefs.map((p) => p.replace(/[()]/g, ''))
      // Only process if all referenced points are known coordinates
      const allKnown = names.every((n) => knownPoints.has(n))
      if (allKnown) {
        for (let i = 0; i < names.length - 1; i++) {
          lines.push({ from: names[i], to: names[i + 1], style })
        }
        // Check for cycle: if path ends with "-- cycle"
        if (/--\s*cycle/.test(path) && names.length > 2) {
          lines.push({ from: names[names.length - 1], to: names[0], style })
        }
      }
    }
  }
  return lines
}

/** Parse \draw (M) circle (radius); */
function parseCircles(
  content: string,
  knownPoints: Set<string>,
): Array<{ center: string; radius: number }> {
  const circles: Array<{ center: string; radius: number }> = []
  const regex = /\\draw(?:\s*\[[^\]]*\])?\s*\((\w+)\)\s*circle\s*\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const center = match[1]
    const radiusStr = match[2].replace(/pt|cm|mm/g, '').trim()
    const radius = parseFloat(radiusStr)
    if (knownPoints.has(center) && !isNaN(radius) && radius > 0.5) {
      circles.push({ center, radius })
    }
  }
  return circles
}

/** Parse \fill (A) circle (3pt) node[...] {Label}; for labeled points */
function parseLabeledPoints(content: string): Map<string, string> {
  const labels = new Map<string, string>()
  const regex = /\\fill\s*\((\w+)\)\s*circle\s*\([^)]+\)\s*node\s*\[[^\]]*\]\s*\{([^}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    labels.set(match[1], match[2].replace(/\$/g, ''))
  }
  return labels
}

/** Parse \tkzMarkRightAngle(A,B,C) for right angle markers */
function parseRightAngles(
  content: string,
  knownPoints: Set<string>,
): Array<{ center: string; ray1: string; ray2: string }> {
  const angles: Array<{ center: string; ray1: string; ray2: string }> = []
  // Match \tkzMarkRightAngle[options](A,B,C) — B is the vertex
  const regex = /\\tkzMarkRightAngle\s*(?:\[[^\]]*\])?\s*\((\w+)\s*,\s*(\w+)\s*,\s*(\w+)\)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const [, ray1, center, ray2] = match
    if (knownPoints.has(ray1) && knownPoints.has(center) && knownPoints.has(ray2)) {
      angles.push({ center, ray1, ray2 })
    }
  }
  return angles
}

/** Canvas display dimensions (pixels) */
const CANVAS_WIDTH = 500
const CANVAS_HEIGHT = 400

/** Padding factor for bounding box (fraction of range to add on each side) */
const BBOX_PADDING = 0.1

/**
 * Compute a JSXGraph bounding box [xMin, yMax, xMax, yMin] that fits all
 * points and circles with padding. Preserves original TikZ coordinates.
 */
function computeBoundingBox(
  points: ParsedPoint[],
  circles: Array<{ center: string; radius: number }>,
  pointMap: Map<string, ParsedPoint>,
): [number, number, number, number] {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }

  // Expand for circles
  for (const c of circles) {
    const center = pointMap.get(c.center)
    if (center) {
      minX = Math.min(minX, center.x - c.radius)
      maxX = Math.max(maxX, center.x + c.radius)
      minY = Math.min(minY, center.y - c.radius)
      maxY = Math.max(maxY, center.y + c.radius)
    }
  }

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const padX = rangeX * BBOX_PADDING
  const padY = rangeY * BBOX_PADDING

  // JSXGraph bounding box: [xMin, yMax, xMax, yMin]
  return [minX - padX, maxY + padY, maxX + padX, minY - padY]
}

/**
 * Attempts to parse a tikzpicture (non-axis) into a QuestionGeometryBlock.
 * Returns null if no meaningful geometry found.
 */
export function parseTikzGeometry(tikzContent: string): QuestionGeometryBlock | null {
  // Skip if this is an axis plot
  if (tikzContent.includes('\\begin{axis}')) return null

  let coordinates = parseCoordinates(tikzContent)
  let labels: Map<string, string>
  let drawLines: Array<{ from: string; to: string; style: 'solid' | 'dashed' }>
  let circles: Array<{ center: string; radius: number }>
  let rightAngles: Array<{ center: string; ray1: string; ray2: string }>

  if (coordinates.length > 0) {
    // Standard path: explicit \coordinate definitions
    const knownPoints = new Set(coordinates.map((p) => p.name))
    labels = parseLabeledPoints(tikzContent)
    drawLines = parseDrawLines(tikzContent, knownPoints)
    circles = parseCircles(tikzContent, knownPoints)
    rightAngles = parseRightAngles(tikzContent, knownPoints)
  } else {
    // Fallback: extract inline coordinates from \draw commands
    const inline = parseInlineDrawCoordinates(tikzContent)
    if (inline.points.length === 0) return null
    coordinates = inline.points
    labels = inline.labels
    drawLines = inline.lines
    circles = []
    rightAngles = []
  }

  const pointMap = new Map(coordinates.map((p) => [p.name, p]))

  // Compute bounding box from raw TikZ coordinates — no normalization needed
  const boundingBox = computeBoundingBox(coordinates, circles, pointMap)

  const geometry: GeometrySpecV1 = {
    kind: 'euclidean',
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      axis: false,
      boundingBox,
    },
    elements: {
      points: coordinates.map((p) => ({
        name: labels.get(p.name) ?? p.name,
        x: p.x,
        y: p.y,
        visible: labels.has(p.name) || !labels.size,
      })),
      lines: drawLines.map((l) => ({
        from: labels.get(l.from) ?? l.from,
        to: labels.get(l.to) ?? l.to,
        style: l.style,
      })),
      circles: circles.map((c) => ({
        center: labels.get(c.center) ?? c.center,
        radius: c.radius,
        style: 'solid' as const,
      })),
      angles: rightAngles.map((a) => ({
        center: labels.get(a.center) ?? a.center,
        ray1: labels.get(a.ray1) ?? a.ray1,
        ray2: labels.get(a.ray2) ?? a.ray2,
        style: 'square' as const,
      })),
    },
  }

  return makeGeometryBlock('', geometry)
}

/** Check if a tikzpicture is coordinate-based geometry (not axis) */
export function hasTikzGeometry(content: string): boolean {
  if (content.includes('\\begin{axis}')) return false
  // Has explicit \coordinate definitions
  if (content.includes('\\coordinate')) return true
  // Has \draw with inline numeric coordinates like (0,0) -- (5,3)
  if (/\\draw[\s\[][^;]*\(\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\)/.test(content)) return true
  return false
}
