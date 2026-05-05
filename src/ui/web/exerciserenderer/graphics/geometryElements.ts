/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GeometrySpecV1 } from '@/infra/contracts'
import { getDefaultTextColor, sizeScaleToPixels } from '@/infra/contracts/graphics/textColors'

type PointSpec = GeometrySpecV1['elements']['points'][number]
type LineSpec = GeometrySpecV1['elements']['lines'][number]
type CircleSpec = GeometrySpecV1['elements']['circles'][number]
type AngleSpec = GeometrySpecV1['elements']['angles'][number]

/** Map compass direction to a pixel [x, y] offset for JSXGraph labels. */
function mapLabelOffset(pos?: string): [number, number] {
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

function renderPoints(board: JXG.Board, points: PointSpec[]): Map<string, any> {
  const pointMap = new Map<string, any>()
  for (const p of points) {
    const pointColor = p.color ?? getDefaultTextColor()
    const pt = board.create('point', [p.x, p.y], {
      name: p.name,
      fixed: true,
      visible: p.visible !== false,
      fillColor: pointColor,
      strokeColor: pointColor,
      size: p.size ?? 4,
      label: {
        offset: mapLabelOffset(p.position),
        fontSize: p.fontSize ?? 12,
        fontFamily: 'Times New Roman',
      },
    })
    pointMap.set(p.name, pt)
  }
  return pointMap
}

function renderLines(
  board: JXG.Board,
  lines: LineSpec[],
  pointMap: Map<string, any>,
  canvasHeight: number,
) {
  for (const line of lines) {
    const from = pointMap.get(line.from)
    const to = pointMap.get(line.to)
    if (!from || !to) continue

    const attrs: Record<string, unknown> = {
      strokeWidth: line.thickness ?? 2,
      dash: line.style === 'dashed' ? 2 : 0,
      straightFirst: false,
      straightLast: false,
    }
    if (line.color) attrs.strokeColor = line.color

    board.create('segment', [from, to], attrs)

    if (line.label?.value) {
      const dx = to.X() - from.X()
      const dy = to.Y() - from.Y()
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const baseOffset = canvasHeight * 0.03
      const offsetDist =
        line.label.position === 'b' ? -baseOffset : line.label.position === 'm' ? 0 : baseOffset
      const midX = (from.X() + to.X()) / 2 + (-dy / len) * offsetDist
      const midY = (from.Y() + to.Y()) / 2 + (dx / len) * offsetDist
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI
      if (deg > 90) deg -= 180
      if (deg < -90) deg += 180
      board.create('text', [midX, midY, line.label.value], {
        fontSize: line.label.fontSize ?? 10,
        anchorX: 'middle',
        anchorY: 'middle',
        display: 'internal',
        rotate: deg,
        fontFamily: 'Times New Roman',
      })
    }
  }
}

function renderCircles(board: JXG.Board, circles: CircleSpec[], pointMap: Map<string, any>) {
  for (const c of circles) {
    const center = pointMap.get(c.center)
    if (!center) continue

    const attrs: Record<string, unknown> = {
      dash: c.style === 'dashed' ? 2 : 0,
      fillColor: 'none',
    }
    if (c.color) attrs.strokeColor = c.color

    if (c.through) {
      const through = pointMap.get(c.through)
      if (through) board.create('circle', [center, through], attrs)
    } else if (c.radius) {
      board.create('circle', [center, c.radius], attrs)
    }
  }
}

function renderAngles(board: JXG.Board, angles: AngleSpec[], pointMap: Map<string, any>) {
  for (const a of angles) {
    const center = pointMap.get(a.center)
    const ray1 = pointMap.get(a.ray1)
    const ray2 = pointMap.get(a.ray2)
    if (!center || !ray1 || !ray2) continue

    const attrs: Record<string, unknown> = {
      radius: a.arcRadius ?? 1,
      type: a.style === 'square' ? 'square' : 'sector',
    }
    if (a.color) attrs.fillColor = a.color
    if (a.label?.value) {
      attrs.name = a.label.value
      attrs.withLabel = true
      attrs.label = {
        fontSize: a.label.fontSize ?? 10,
        fontFamily: 'Times New Roman',
      }
    }

    board.create('angle', [ray1, center, ray2], attrs)
  }
}

/**
 * Render all geometry elements from a GeometrySpecV1 onto a JSXGraph board.
 */
export function renderGeometrySpec(board: JXG.Board, spec: GeometrySpecV1): void {
  const pointMap = renderPoints(board, spec.elements.points)
  renderLines(board, spec.elements.lines, pointMap, spec.canvas.height)
  renderCircles(board, spec.elements.circles, pointMap)
  renderAngles(board, spec.elements.angles, pointMap)

  if (spec.elements.vectors) {
    for (const v of spec.elements.vectors) {
      const from = pointMap.get(v.from)
      const to = pointMap.get(v.to)
      if (!from || !to) continue
      const attrs: Record<string, unknown> = {
        strokeWidth: v.thickness ?? 2,
        dash: v.style === 'dashed' ? 2 : 0,
      }
      if (v.color) attrs.strokeColor = v.color
      board.create('arrow', [from, to], attrs)
    }
  }

  if (spec.elements.areas) {
    for (const area of spec.elements.areas) {
      const pts = area.polygon.map((name) => pointMap.get(name)).filter(Boolean)
      if (pts.length >= 3) {
        const attrs: Record<string, unknown> = {
          fillOpacity: 0.3,
          borders: { strokeWidth: 0 },
        }
        if (area.color) attrs.fillColor = area.color
        board.create('polygon', pts, attrs)
      }
    }
  }

  if (spec.elements.rectangles) {
    for (const rect of spec.elements.rectangles) {
      const pts = rect.points.map((name) => pointMap.get(name)).filter(Boolean)
      if (pts.length === 4) {
        const attrs: Record<string, unknown> = {
          borders: {
            strokeWidth: rect.thickness ?? 2,
            dash: rect.style === 'dashed' ? 2 : 0,
          },
        }
        if (rect.color) {
          attrs.borders = { ...(attrs.borders as object), strokeColor: rect.color }
        }
        if (rect.fill) {
          attrs.fillColor = rect.fill
          attrs.fillOpacity = 0.3
        }
        board.create('polygon', pts, attrs)
      }
    }
  }

  if (spec.elements.triangles) {
    for (const tri of spec.elements.triangles) {
      const pts = tri.points.map((name) => pointMap.get(name)).filter(Boolean)
      if (pts.length === 3) {
        const attrs: Record<string, unknown> = {
          borders: {
            strokeWidth: tri.thickness ?? 2,
            dash: tri.style === 'dashed' ? 2 : 0,
          },
        }
        if (tri.color) {
          attrs.borders = { ...(attrs.borders as object), strokeColor: tri.color }
        }
        if (tri.fill) {
          attrs.fillColor = tri.fill
          attrs.fillOpacity = 0.3
        }
        board.create('polygon', pts, attrs)
      }
    }
  }

  if (spec.elements.texts) {
    for (const text of spec.elements.texts) {
      let x = text.place?.x ?? 0
      let y = text.place?.y ?? 0

      if (text.on?.from && text.on?.to) {
        const from = pointMap.get(text.on.from)
        const to = pointMap.get(text.on.to)
        if (from && to) {
          x = (from.X() + to.X()) / 2
          y = (from.Y() + to.Y()) / 2
        }
      }

      const color = text.color ?? getDefaultTextColor()
      board.create('text', [x, y, text.value], {
        fontSize:
          text.sizeScale !== undefined ? sizeScaleToPixels(text.sizeScale) : (text.fontSize ?? 14),
        strokeColor: color,
        color,
        anchorX: 'middle',
        anchorY: 'middle',
      })
    }
  }
}
