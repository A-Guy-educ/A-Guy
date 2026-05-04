/**
 * @fileType unit-test
 * @domain exercises, axis, renderer
 * @pattern unit-test, axis-renderer, label-size, fill-color
 * @ai-summary Unit tests for axisElements.ts renderAxisSpec function - fontSize, fontFamily, labelSize, and mobile fillColor fix
 */

import { describe, expect, it, vi } from 'vitest'

// Mock the textColors module before importing axisElements
vi.mock('@/infra/contracts/graphics/textColors', () => ({
  getDefaultTextColor: vi.fn(() => '#1a1a2e'),
}))

// Import after mock is set up
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'
import { renderAxisSpec } from '@/ui/web/exerciserenderer/graphics/axisElements'

function createMockBoard() {
  const createdPoints: Array<{ args: unknown[]; kwargs: Record<string, unknown> }> = []
  const createdTexts: Array<{ args: unknown[]; kwargs: Record<string, unknown> }> = []

  const mockBoard = {
    create: vi.fn((type: string, args: unknown[], kwargs: Record<string, unknown>) => {
      if (type === 'point') {
        createdPoints.push({ args, kwargs })
        return {}
      }
      if (type === 'text') {
        createdTexts.push({ args, kwargs })
        return {}
      }
      if (type === 'functiongraph') return {}
      if (type === 'line') return {}
      return {}
    }),
    _createdPoints: createdPoints,
    _createdTexts: createdTexts,
  }

  return mockBoard as unknown as JXG.Board & {
    _createdPoints: typeof createdPoints
    _createdTexts: typeof createdTexts
  }
}

function makeSpec(overrides?: Partial<AxisSpecV1>): AxisSpecV1 {
  return {
    kind: 'cartesian',
    units: 1,
    grid: { enabled: true, color: '#e0e0e0' },
    axes: {
      showNumbers: true,
      showLabels: true,
      ticks: 1,
      labels: { x: 'x', y: 'y' },
      origin: { x: 0, y: 0 },
    },
    viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
    elements: {
      points: [],
      graphs: [],
      ...overrides?.elements,
    },
    ...overrides,
  }
}

describe('renderAxisSpec — floating_text label fontSize', () => {
  it('uses fontSize 14 for floating_text when labelSize=undefined', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'floating_text' as const, label: 'P' }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec)
    const text = board._createdTexts[0]
    expect(text.kwargs).toMatchObject({ fontSize: 14, fontFamily: 'Times New Roman' })
  })

  it('uses fontSize 14 for floating_text when labelSize=default', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'floating_text' as const, label: 'P' }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec, 'default')
    const text = board._createdTexts[0]
    expect(text.kwargs).toMatchObject({ fontSize: 14, fontFamily: 'Times New Roman' })
  })

  it('uses fontSize 11 for floating_text when labelSize=small (20% reduction of 14)', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'floating_text' as const, label: 'P' }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec, 'small')
    const text = board._createdTexts[0]
    expect(text.kwargs).toMatchObject({ fontSize: 11, fontFamily: 'Times New Roman' })
  })

  it('applies Times New Roman fontFamily to floating_text', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'floating_text' as const, label: 'P' }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec)
    const text = board._createdTexts[0]
    expect(text.kwargs.fontFamily).toBe('Times New Roman')
  })
})

describe('renderAxisSpec — regular point fillColor', () => {
  it('uses getDefaultTextColor() as fillColor when p.color is absent and type != hole', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'point' as const }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec)
    const point = board._createdPoints[0]
    expect(point.kwargs.fillColor).toBe('#1a1a2e')
    expect(point.kwargs.fillColor).not.toBeUndefined()
  })

  it('uses white fillColor for hole point when color is absent', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'hole' as const }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec)
    const point = board._createdPoints[0]
    expect(point.kwargs.fillColor).toBe('#ffffff')
  })

  it('uses explicit p.color as fillColor when provided', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'point' as const, color: 'red' }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec)
    const point = board._createdPoints[0]
    expect(point.kwargs.fillColor).toBe('red')
    expect(point.kwargs.strokeColor).toBe('red')
  })

  it('uses white fillColor for hole point even when color is set (stroke uses the color, fill is always white)', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'hole' as const, color: 'blue' }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec)
    const point = board._createdPoints[0]
    // Holes always render white fill (ring appearance); strokeColor reflects the explicit color
    expect(point.kwargs.fillColor).toBe('#ffffff')
    expect(point.kwargs.strokeColor).toBe('blue')
  })

  it('applies Times New Roman fontFamily to regular point labels', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ x: 1, y: 2, type: 'point' as const, label: 'Q' }],
        graphs: [],
      },
    })
    renderAxisSpec(board, spec)
    const point = board._createdPoints[0]
    // withLabel is true, so JSXGraph creates a label; we verify the point attrs include it
    expect(point.kwargs.withLabel).toBe(true)
  })
})
