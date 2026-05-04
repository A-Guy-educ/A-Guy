/**
 * @fileType unit-test
 * @domain exercises, geometry, renderer
 * @pattern unit-test, geometry-renderer, label-size
 * @ai-summary Unit tests for geometryElements.ts renderGeometrySpec function - fontSize defaults, labelSize parameter, and per-element overrides
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock the textColors module before importing geometryElements
vi.mock('@/infra/contracts/graphics/textColors', () => ({
  getDefaultTextColor: vi.fn(() => '#1a1a2e'),
  sizeScaleToPixels: vi.fn(
    (scale: number) =>
      [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24][Math.max(0, Math.min(10, scale))] ?? 14,
  ),
}))

// Import after mock is set up
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import { renderGeometrySpec } from '@/ui/web/exerciserenderer/graphics/geometryElements'

// Mock JXG.Board
function createMockBoard() {
  const createdPoints: Array<{ args: unknown[]; kwargs: Record<string, unknown> }> = []
  const createdTexts: Array<{ args: unknown[]; kwargs: Record<string, unknown> }> = []
  const createdAngles: Array<{ args: unknown[]; kwargs: Record<string, unknown> }> = []

  const mockPoint = (name: string) => ({
    name,
    label: {},
    X: () => 0,
    Y: () => 0,
  })

  const mockBoard = {
    create: vi.fn((type: string, args: unknown[], kwargs: Record<string, unknown>) => {
      if (type === 'point') {
        const pointName = args[1] as string
        createdPoints.push({ args, kwargs })
        return mockPoint(pointName)
      }
      if (type === 'text') {
        createdTexts.push({ args, kwargs })
        return {}
      }
      if (type === 'angle') {
        createdAngles.push({ args, kwargs })
        return {}
      }
      if (type === 'segment') return {}
      if (type === 'circle') return {}
      if (type === 'arrow') return {}
      if (type === 'polygon') return {}
      return {}
    }),
    // Expose captured data for assertions
    _createdPoints: createdPoints,
    _createdTexts: createdTexts,
    _createdAngles: createdAngles,
  }

  return mockBoard as unknown as JXG.Board & {
    _createdPoints: typeof createdPoints
    _createdTexts: typeof createdTexts
    _createdAngles: typeof createdAngles
  }
}

function makeSpec(overrides?: Partial<GeometrySpecV1>): GeometrySpecV1 {
  return {
    kind: 'euclidean',
    canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
    elements: {
      points: [{ name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' }],
      lines: [],
      circles: [],
      angles: [],
      ...overrides?.elements,
    },
    interactionSpec: { enabled: false, toolsAllowed: [], evaluation: { mode: 'none' } },
    ...overrides,
  }
}

describe('renderGeometrySpec — point label fontSize', () => {
  it('uses default fontSize 12 when no per-element override and labelSize=undefined', () => {
    const board = createMockBoard()
    const spec = makeSpec()
    renderGeometrySpec(board, spec)
    const point = board._createdPoints[0]
    expect(point.kwargs.label).toMatchObject({ fontSize: 12 })
  })

  it('uses default fontSize 12 when labelSize=default', () => {
    const board = createMockBoard()
    const spec = makeSpec()
    renderGeometrySpec(board, spec, 'default')
    const point = board._createdPoints[0]
    expect(point.kwargs.label).toMatchObject({ fontSize: 12 })
  })

  it('uses fontSize 10 when labelSize=small (20% reduction of 12)', () => {
    const board = createMockBoard()
    const spec = makeSpec()
    renderGeometrySpec(board, spec, 'small')
    const point = board._createdPoints[0]
    expect(point.kwargs.label).toMatchObject({ fontSize: 10 })
  })

  it('uses per-element fontSize override even when labelSize=small', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [{ name: 'A', x: 0, y: 0, position: 'r', visible: true, fontSize: 20 }],
        lines: [],
        circles: [],
        angles: [],
      },
    })
    renderGeometrySpec(board, spec, 'small')
    const point = board._createdPoints[0]
    expect(point.kwargs.label).toMatchObject({ fontSize: 20 })
  })

  it('applies Times New Roman fontFamily to point labels', () => {
    const board = createMockBoard()
    const spec = makeSpec()
    renderGeometrySpec(board, spec)
    const point = board._createdPoints[0]
    expect(point.kwargs.label).toMatchObject({ fontFamily: 'Times New Roman' })
  })
})

describe('renderGeometrySpec — line label fontSize', () => {
  it('uses default line label fontSize 10 when no per-element override', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [
          { name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'B', x: 1, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
        ],
        lines: [
          {
            from: 'A',
            to: 'B',
            style: 'solid' as const,
            label: { value: 'AB', position: 't' as const },
          },
        ],
        circles: [],
        angles: [],
      },
    })
    renderGeometrySpec(board, spec)
    const text = board._createdTexts[0]
    expect(text.kwargs).toMatchObject({ fontSize: 10, fontFamily: 'Times New Roman' })
  })

  it('uses line label fontSize 8 when labelSize=small', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [
          { name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'B', x: 1, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
        ],
        lines: [
          {
            from: 'A',
            to: 'B',
            style: 'solid' as const,
            label: { value: 'AB', position: 't' as const },
          },
        ],
        circles: [],
        angles: [],
      },
    })
    renderGeometrySpec(board, spec, 'small')
    const text = board._createdTexts[0]
    expect(text.kwargs).toMatchObject({ fontSize: 8, fontFamily: 'Times New Roman' })
  })

  it('respects per-element line label fontSize override with labelSize=small', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [
          { name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'B', x: 1, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
        ],
        lines: [
          {
            from: 'A',
            to: 'B',
            style: 'solid' as const,
            label: { value: 'AB', position: 't' as const, fontSize: 16 },
          },
        ],
        circles: [],
        angles: [],
      },
    })
    renderGeometrySpec(board, spec, 'small')
    const text = board._createdTexts[0]
    expect(text.kwargs).toMatchObject({ fontSize: 16 })
  })
})

describe('renderGeometrySpec — angle label fontSize', () => {
  it('uses default angle label fontSize 10 when no per-element override', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [
          { name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'B', x: 1, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'C', x: 1, y: 1, position: 'r', visible: true, color: '#1a1a2e' },
        ],
        lines: [],
        circles: [],
        angles: [
          {
            center: 'B',
            ray1: 'A',
            ray2: 'C',
            label: { value: '90°', position: 'inside' as const },
          },
        ],
      },
    })
    renderGeometrySpec(board, spec)
    const angle = board._createdAngles[0]
    expect(angle.kwargs.label).toMatchObject({ fontSize: 10, fontFamily: 'Times New Roman' })
  })

  it('uses angle label fontSize 8 when labelSize=small', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [
          { name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'B', x: 1, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'C', x: 1, y: 1, position: 'r', visible: true, color: '#1a1a2e' },
        ],
        lines: [],
        circles: [],
        angles: [
          {
            center: 'B',
            ray1: 'A',
            ray2: 'C',
            label: { value: '90°', position: 'inside' as const },
          },
        ],
      },
    })
    renderGeometrySpec(board, spec, 'small')
    const angle = board._createdAngles[0]
    expect(angle.kwargs.label).toMatchObject({ fontSize: 8, fontFamily: 'Times New Roman' })
  })

  it('respects per-element angle label fontSize override', () => {
    const board = createMockBoard()
    const spec = makeSpec({
      elements: {
        points: [
          { name: 'A', x: 0, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'B', x: 1, y: 0, position: 'r', visible: true, color: '#1a1a2e' },
          { name: 'C', x: 1, y: 1, position: 'r', visible: true, color: '#1a1a2e' },
        ],
        lines: [],
        circles: [],
        angles: [
          {
            center: 'B',
            ray1: 'A',
            ray2: 'C',
            label: { value: '90°', position: 'inside' as const, fontSize: 18 },
          },
        ],
      },
    })
    renderGeometrySpec(board, spec, 'small')
    const angle = board._createdAngles[0]
    expect(angle.kwargs.label).toMatchObject({ fontSize: 18 })
  })
})
