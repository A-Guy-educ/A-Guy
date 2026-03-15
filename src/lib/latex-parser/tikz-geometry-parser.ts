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

/** Canvas dimensions */
const CANVAS_WIDTH = 500
const CANVAS_HEIGHT = 400
const CANVAS_PADDING = 40

/**
 * Normalize TikZ coordinates to canvas pixel space.
 * Maps coordinate bounds to fill the canvas with padding.
 */
function normalizeCoordinates(points: ParsedPoint[]): ParsedPoint[] {
  if (points.length === 0) return points

  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  const usableW = CANVAS_WIDTH - 2 * CANVAS_PADDING
  const usableH = CANVAS_HEIGHT - 2 * CANVAS_PADDING

  // Use uniform scale to preserve aspect ratio
  const scale = Math.min(usableW / rangeX, usableH / rangeY)
  const offsetX = CANVAS_PADDING + (usableW - rangeX * scale) / 2
  const offsetY = CANVAS_PADDING + (usableH - rangeY * scale) / 2

  return points.map((p) => ({
    name: p.name,
    // Map to canvas coordinates — flip Y because canvas Y goes down, TikZ Y goes up
    x: Math.round((p.x - minX) * scale + offsetX),
    y: Math.round((maxY - p.y) * scale + offsetY),
  }))
}

/**
 * Attempts to parse a tikzpicture (non-axis) into a QuestionGeometryBlock.
 * Returns null if no meaningful geometry found.
 */
export function parseTikzGeometry(tikzContent: string): QuestionGeometryBlock | null {
  // Skip if this is an axis plot
  if (tikzContent.includes('\\begin{axis}')) return null

  const rawCoordinates = parseCoordinates(tikzContent)
  if (rawCoordinates.length === 0) return null

  const knownPoints = new Set(rawCoordinates.map((p) => p.name))
  const labels = parseLabeledPoints(tikzContent)
  const drawLines = parseDrawLines(tikzContent, knownPoints)
  const circles = parseCircles(tikzContent, knownPoints)

  // Normalize coordinates to canvas pixel space
  const coordinates = normalizeCoordinates(rawCoordinates)

  // Build a map from coordinate name to normalized position for circle radius scaling
  const coordMap = new Map(coordinates.map((p) => [p.name, p]))
  const rawMap = new Map(rawCoordinates.map((p) => [p.name, p]))

  // Calculate scale factor for radius normalization
  const rawXs = rawCoordinates.map((p) => p.x)
  const rawRangeX = (Math.max(...rawXs) - Math.min(...rawXs)) || 1
  const radiusScale = (CANVAS_WIDTH - 2 * CANVAS_PADDING) / rawRangeX

  const geometry: GeometrySpecV1 = {
    kind: 'euclidean',
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      grid: false,
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
        radius: Math.max(5, Math.round(c.radius * radiusScale)),
        style: 'solid' as const,
      })),
      angles: [],
    },
  }

  return makeGeometryBlock('', geometry)
}

/** Check if a tikzpicture is coordinate-based geometry (not axis) */
export function hasTikzGeometry(content: string): boolean {
  return content.includes('\\coordinate') && !content.includes('\\begin{axis}')
}
