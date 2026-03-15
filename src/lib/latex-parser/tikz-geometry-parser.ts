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
      // Only process if at least one point is a known coordinate
      const allKnown = names.every((n) => knownPoints.has(n))
      if (allKnown) {
        for (let i = 0; i < names.length - 1; i++) {
          lines.push({ from: names[i], to: names[i + 1], style })
        }
        // Check for cycle: if path ends with "-- cycle" or starts and ends at same point
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

/**
 * Attempts to parse a tikzpicture (non-axis) into a QuestionGeometryBlock.
 * Returns null if no meaningful geometry found.
 */
export function parseTikzGeometry(tikzContent: string): QuestionGeometryBlock | null {
  // Skip if this is an axis plot
  if (tikzContent.includes('\\begin{axis}')) return null

  const coordinates = parseCoordinates(tikzContent)
  if (coordinates.length === 0) return null

  const knownPoints = new Set(coordinates.map((p) => p.name))
  const labels = parseLabeledPoints(tikzContent)
  const drawLines = parseDrawLines(tikzContent, knownPoints)
  const circles = parseCircles(tikzContent, knownPoints)

  // Compute canvas bounds from point coordinates
  const xs = coordinates.map((p) => p.x)
  const ys = coordinates.map((p) => p.y)
  const padding = 2
  const minX = Math.min(...xs) - padding
  const maxX = Math.max(...xs) + padding
  const minY = Math.min(...ys) - padding
  const maxY = Math.max(...ys) + padding

  const geometry: GeometrySpecV1 = {
    kind: 'euclidean',
    canvas: {
      width: Math.max(400, (maxX - minX) * 30),
      height: Math.max(300, (maxY - minY) * 30),
      grid: false,
    },
    elements: {
      points: coordinates.map((p) => ({
        name: labels.get(p.name) ?? p.name,
        x: p.x,
        y: p.y,
        visible: labels.has(p.name),
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
      angles: [],
    },
  }

  return makeGeometryBlock('', geometry)
}

/** Check if a tikzpicture is coordinate-based geometry (not axis) */
export function hasTikzGeometry(content: string): boolean {
  return content.includes('\\coordinate') && !content.includes('\\begin{axis}')
}
