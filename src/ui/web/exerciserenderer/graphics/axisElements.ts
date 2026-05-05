import type { AxisSpecV1 } from '@/infra/contracts'
import { getDefaultTextColor } from '@/infra/contracts/graphics/textColors'
import { parseMathExpression } from '../utils/safeMathEval'

type GraphSpec = AxisSpecV1['elements']['graphs'][number]
type PointSpec = AxisSpecV1['elements']['points'][number]

function renderGraphs(
  board: JXG.Board,
  graphs: GraphSpec[],
  viewport: AxisSpecV1['viewport'],
): void {
  for (const graph of graphs) {
    const parsed = parseMathExpression(graph.fn)
    if (!parsed.valid) continue

    const attrs: Record<string, unknown> = {
      strokeWidth: graph.thickness,
      dash: graph.style === 'dashed' ? 2 : 0,
    }
    if (graph.color) attrs.strokeColor = graph.color

    // Always clip to domain or viewport — prevents polynomial explosion outside visible range
    const rangeFrom = graph.range?.fromX ?? viewport?.xMin ?? -5
    const rangeTo = graph.range?.toX ?? viewport?.xMax ?? 5

    board.create('functiongraph', [parsed.evaluate, rangeFrom, rangeTo], attrs)
  }
}

function renderAxisPoints(board: JXG.Board, points: PointSpec[]) {
  for (const p of points) {
    if (p.type === 'floating_text') {
      board.create('text', [p.x, p.y, p.label || ''], {
        fontSize: 14,
        anchorX: 'middle',
        anchorY: 'middle',
        fontFamily: 'Times New Roman',
      })
    } else {
      const attrs: Record<string, unknown> = {
        name: p.label || '',
        fixed: true,
        size: 4,
        withLabel: !!p.label,
      }
      if (p.color) {
        attrs.strokeColor = p.color
        attrs.fillColor = p.type === 'hole' ? '#ffffff' : p.color
      } else {
        attrs.fillColor = p.type === 'hole' ? '#ffffff' : getDefaultTextColor()
      }
      if (p.type === 'hole') {
        attrs.strokeWidth = 2
      }

      board.create('point', [p.x, p.y], attrs)
    }
  }
}

function renderVerticalAsymptotes(board: JXG.Board, values: number[]) {
  for (const x of values) {
    board.create(
      'line',
      [
        [x, 0],
        [x, 1],
      ],
      {
        dash: 3,
        strokeColor: '#999',
        strokeWidth: 1,
        straightFirst: true,
        straightLast: true,
        fixed: true,
      },
    )
  }
}

function renderHorizontalAsymptotes(board: JXG.Board, values: number[]) {
  for (const y of values) {
    board.create(
      'line',
      [
        [0, y],
        [1, y],
      ],
      {
        dash: 3,
        strokeColor: '#999',
        strokeWidth: 1,
        straightFirst: true,
        straightLast: true,
        fixed: true,
      },
    )
  }
}

function renderLineBetweenPoints(
  board: JXG.Board,
  lines: NonNullable<AxisSpecV1['elements']['lineBetweenPoints']>,
) {
  for (const line of lines) {
    const attrs: Record<string, unknown> = {
      strokeWidth: line.thickness,
      dash: line.style === 'dashed' ? 2 : 0,
      straightFirst: false,
      straightLast: false,
    }
    if (line.color) attrs.strokeColor = line.color
    board.create(
      'segment',
      [
        [line.a.x, line.a.y],
        [line.b.x, line.b.y],
      ],
      attrs,
    )
  }
}

/**
 * Render all axis elements from an AxisSpecV1 onto a JSXGraph board.
 */
export function renderAxisSpec(board: JXG.Board, spec: AxisSpecV1): void {
  renderGraphs(board, spec.elements.graphs, spec.viewport)
  renderAxisPoints(board, spec.elements.points)

  if (spec.elements.asymptotesVertical?.length) {
    renderVerticalAsymptotes(board, spec.elements.asymptotesVertical)
  }
  if (spec.elements.asymptotesHorizontal?.length) {
    renderHorizontalAsymptotes(board, spec.elements.asymptotesHorizontal)
  }
  if (spec.elements.lineBetweenPoints?.length) {
    renderLineBetweenPoints(board, spec.elements.lineBetweenPoints)
  }
}
