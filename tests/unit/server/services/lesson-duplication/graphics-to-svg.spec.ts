/**
 * Unit tests for src/server/services/lesson-duplication/graphics-to-svg.ts
 *
 * Snapshot tests for geometry and axis SVG rendering.
 * Reference fixtures under tests/unit/server/services/lesson-duplication/graphics-to-svg.fixtures/
 */
import { describe, expect, it } from 'vitest'
import {
  geometrySpecToSvg,
  axisSpecToSvg,
  multiAxisToSvg,
} from '@/server/services/lesson-duplication/graphics-to-svg'
import type { GeometrySpecV1 } from '@/infra/contracts/graphics/geometry.v1'
import type { AxisSpecV1 } from '@/infra/contracts/graphics/axis.v1'

// -------------------------------------------
// GeometrySpec fixtures
// -------------------------------------------

const triangleGeometrySpec: GeometrySpecV1 = {
  kind: 'euclidean',
  canvas: { width: 400, height: 300 },
  elements: {
    points: [
      { name: 'A', x: 50, y: 50 },
      { name: 'B', x: 200, y: 50 },
      { name: 'C', x: 125, y: 150 },
    ],
    lines: [],
    circles: [],
    angles: [],
    triangles: [
      {
        points: ['A', 'B', 'C'],
        style: 'solid',
        thickness: 2,
        color: '#000000',
      },
    ],
  },
}

const labeledPointGeometrySpec: GeometrySpecV1 = {
  kind: 'euclidean',
  canvas: { width: 400, height: 300 },
  elements: {
    points: [
      { name: 'P', x: 100, y: 100, position: 't' },
      { name: 'Q', x: 250, y: 200, position: 'b' },
    ],
    lines: [{ from: 'P', to: 'Q', style: 'solid', thickness: 2 }],
    circles: [],
    angles: [],
  },
}

const lineCircleGeometrySpec: GeometrySpecV1 = {
  kind: 'euclidean',
  canvas: { width: 400, height: 300 },
  elements: {
    points: [
      { name: 'O', x: 200, y: 150 },
      { name: 'A', x: 280, y: 150 },
    ],
    lines: [{ from: 'O', to: 'A', style: 'solid', thickness: 2 }],
    circles: [
      {
        center: 'O',
        through: 'A',
        style: 'solid',
        color: '#2563eb',
      },
    ],
    angles: [],
    vectors: [
      {
        from: 'O',
        to: 'A',
        color: '#dc2626',
        thickness: 2,
        style: 'solid',
      },
    ],
  },
}

const fullGeometrySpec: GeometrySpecV1 = {
  kind: 'euclidean',
  canvas: { width: 500, height: 400, background: '#ffffff', grid: true, axis: true },
  elements: {
    points: [
      { name: 'A', x: 50, y: 50 },
      { name: 'B', x: 250, y: 50 },
      { name: 'C', x: 150, y: 200 },
    ],
    lines: [
      { from: 'A', to: 'B', style: 'dashed', thickness: 1, label: { value: 'AB', position: 'm' } },
    ],
    circles: [{ center: 'C', radius: 50, style: 'solid', color: '#16a34a' }],
    angles: [
      {
        center: 'A',
        ray1: 'B',
        ray2: 'C',
        arcRadius: 1,
        color: '#ea580c',
        style: 'arc',
        label: { value: '30°', position: 'inside', fontSize: 12 },
      },
    ],
    vectors: [{ from: 'A', to: 'C', color: '#9333ea', thickness: 2, style: 'solid' }],
    areas: [{ polygon: ['A', 'B', 'C'], style: 'solid', color: '#f59e0b' }],
    rectangles: [],
    triangles: [{ points: ['A', 'B', 'C'], style: 'solid', thickness: 2, color: '#000000' }],
    texts: [{ value: 'Triangle', on: { from: 'A', to: 'C' }, fontSize: 14, color: '#1a1a2e' }],
    equalSegments: [[{ from: 'A', to: 'B' }]],
    tangents: [],
  },
}

// -------------------------------------------
// AxisSpec fixtures
// -------------------------------------------

const basicAxisSpec: AxisSpecV1 = {
  kind: 'cartesian',
  units: 1,
  grid: { enabled: true, color: '#e0e0e0' },
  axes: {
    axisColor: '#000000',
    numberColor: '#666666',
    labelColor: '#000000',
    showNumbers: true,
    showLabels: true,
    ticks: 1,
    labels: { x: 'x', y: 'y' },
    origin: { x: 0, y: 0 },
    tickPosition: { x: 'default', y: 'default' },
  },
  viewportMode: 'manual',
  viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  elements: {
    points: [],
    graphs: [],
  },
}

const axisWithFunctionSpec: AxisSpecV1 = {
  kind: 'cartesian',
  units: 1,
  grid: { enabled: true },
  axes: {
    showNumbers: true,
    showLabels: true,
    ticks: 1,
    labels: { x: 'x', y: 'y' },
    origin: { x: 0, y: 0 },
    tickPosition: { x: 'default', y: 'default' },
  },
  viewportMode: 'manual',
  viewport: { xMin: -5, xMax: 5, yMin: -30, yMax: 30 },
  elements: {
    points: [{ x: 0, y: 0, label: 'O', type: 'point' }],
    graphs: [
      {
        id: 'g1',
        fn: 'x^2-5*x',
        style: 'solid',
        thickness: 2,
        color: '#2563eb',
      },
    ],
  },
}

const multiFunctionAxisSpec: AxisSpecV1 = {
  kind: 'cartesian',
  units: 1,
  grid: { enabled: false },
  axes: {
    showNumbers: false,
    showLabels: false,
    ticks: 1,
    labels: { x: 'x', y: 'y' },
    origin: { x: 0, y: 0 },
    tickPosition: { x: 'default', y: 'default' },
  },
  viewportMode: 'manual',
  viewport: { xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
  elements: {
    points: [],
    graphs: [
      {
        id: 'g1',
        fn: 'sin(x)',
        style: 'solid',
        thickness: 2,
        color: '#2563eb',
      },
      {
        id: 'g2',
        fn: 'cos(x)',
        style: 'dashed',
        thickness: 2,
        color: '#dc2626',
      },
    ],
  },
}

const complexAxisSpec: AxisSpecV1 = {
  kind: 'cartesian',
  units: 1,
  grid: { enabled: true, color: '#e0e0e0' },
  axes: {
    showNumbers: true,
    showLabels: true,
    ticks: 2,
    labels: { x: 't', y: 's' },
    origin: { x: 0, y: 0 },
    tickPosition: { x: 'default', y: 'default' },
  },
  viewportMode: 'manual',
  viewport: { xMin: -10, xMax: 10, yMin: -5, yMax: 20 },
  elements: {
    points: [
      { x: 2, y: 4, label: 'P', type: 'point', labelPosition: 't' },
      { x: 5, y: -2, label: 'Q', type: 'hole', labelPosition: 'b' },
    ],
    graphs: [
      {
        id: 'linear',
        fn: '2*x+1',
        style: 'solid',
        thickness: 2,
        color: '#16a34a',
        range: { fromX: -5, toX: 5 },
      },
      {
        id: 'quadratic',
        fn: 'x^2-4',
        style: 'dashed',
        thickness: 1.5,
        color: '#9333ea',
        paint: {
          underGraph: [{ fromX: -3, toX: 3, fillColor: '#f59e0b' }],
        },
      },
    ],
    asymptotesVertical: [],
    asymptotesHorizontal: [],
    paintBetweenGraphs: [],
    lineBetweenPoints: [
      {
        style: 'solid',
        thickness: 1,
        a: { x: 2, y: 4 },
        b: { x: 5, y: -2 },
        color: '#6b7280',
      },
    ],
    geometricLoci: [],
  },
}

// -------------------------------------------
// Tests
// -------------------------------------------

describe('geometrySpecToSvg', () => {
  it('renders a triangle geometry spec to SVG', () => {
    const svg = geometrySpecToSvg(triangleGeometrySpec)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="400"')
    expect(svg).toContain('height="300"')
    expect(svg).toContain('<polygon')
    expect(svg).toContain('</svg>')
  })

  it('renders labeled points with name labels', () => {
    const svg = geometrySpecToSvg(labeledPointGeometrySpec)
    expect(svg).toContain('<circle')
    expect(svg).toContain('>P<')
    expect(svg).toContain('>Q<')
    expect(svg).toContain('<line')
  })

  it('renders line and circle together', () => {
    const svg = geometrySpecToSvg(lineCircleGeometrySpec)
    expect(svg).toContain('<line')
    expect(svg).toContain('<circle')
    expect(svg).toContain('<polygon') // arrowhead on vector
  })

  it('renders full geometry spec with all elements', () => {
    const svg = geometrySpecToSvg(fullGeometrySpec)
    expect(svg).toContain('width="500"')
    expect(svg).toContain('height="400"')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('<polygon') // triangle
    expect(svg).toContain('<circle') // circle
    expect(svg).toContain('<line') // line
    expect(svg).toContain('<path') // angle arc
    expect(svg).toContain('<text') // labels and text
  })

  it('returns empty string for invalid input', () => {
    expect(geometrySpecToSvg(null)).toBe('')
    expect(geometrySpecToSvg(undefined)).toBe('')
    expect(geometrySpecToSvg({})).toBe('')
    expect(geometrySpecToSvg({ kind: 'invalid' })).toBe('')
    // Empty elements object is valid Zod - renders SVG with empty canvas
    expect(
      geometrySpecToSvg({
        kind: 'euclidean',
        canvas: { width: 400, height: 300 },
        elements: { points: [], lines: [], circles: [], angles: [] },
      }),
    ).toContain('<svg')
  })

  it('returns empty string for spec with invalid point x coordinate', () => {
    const invalidSpec = {
      kind: 'euclidean',
      canvas: { width: 400, height: 300 },
      elements: {
        points: [{ name: 'A', x: 'not-a-number' as unknown as number, y: 0 }],
        lines: [],
        circles: [],
        angles: [],
      },
    }
    expect(geometrySpecToSvg(invalidSpec)).toBe('')
  })

  it('escapes XML special characters in labels', () => {
    const spec: GeometrySpecV1 = {
      kind: 'euclidean',
      canvas: { width: 400, height: 300 },
      elements: {
        points: [{ name: 'A&B', x: 100, y: 100 }],
        lines: [],
        circles: [],
        angles: [],
        texts: [{ value: '3 < 5 & 7 > 2', place: { x: 100, y: 100 }, fontSize: 12 }],
      },
    }
    const svg = geometrySpecToSvg(spec)
    expect(svg).toContain('&amp;')
    expect(svg).toContain('&lt;')
    expect(svg).toContain('&gt;')
  })
})

describe('axisSpecToSvg', () => {
  it('renders a basic axis spec with grid', () => {
    const svg = axisSpecToSvg(basicAxisSpec)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="600"')
    expect(svg).toContain('height="400"')
    expect(svg).toContain('<line') // gridlines and axes
    expect(svg).toContain('<polygon') // arrowheads
    expect(svg).toContain('</svg>')
  })

  it('renders axis with function plot y=x^2-5*x', () => {
    const svg = axisSpecToSvg(axisWithFunctionSpec)
    expect(svg).toContain('<polyline')
    expect(svg).toContain('points="') // polyline has points
    // The function should produce points for the curve
    expect(svg).toContain('fill="none"')
  })

  it('renders multi-function axis spec', () => {
    const svg = axisSpecToSvg(multiFunctionAxisSpec)
    expect(svg).toContain('<polyline')
    // Should have multiple polylines (one per function)
    const polylineCount = (svg.match(/<polyline/g) || []).length
    expect(polylineCount).toBeGreaterThanOrEqual(2)
  })

  it('renders complex axis spec with multiple element types', () => {
    const svg = axisSpecToSvg(complexAxisSpec)
    expect(svg).toContain('<circle') // points
    expect(svg).toContain('<polyline') // graphs and line between points
    expect(svg).toContain('<polygon') // fill area under graph
    expect(svg).toContain('fill-opacity="0.3"') // paint area
    expect(svg).toContain('<text') // labels
  })

  it('returns empty string for invalid input', () => {
    expect(axisSpecToSvg(null)).toBe('')
    expect(axisSpecToSvg(undefined)).toBe('')
    expect(axisSpecToSvg({})).toBe('')
    expect(axisSpecToSvg({ kind: 'invalid' })).toBe('')
    expect(
      axisSpecToSvg({
        kind: 'cartesian',
        units: -1,
        grid: { enabled: false },
        axes: {
          showNumbers: false,
          showLabels: false,
          ticks: 0,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: { points: [], graphs: [] },
      }),
    ).toBe('')
  })

  it('returns empty string for spec missing required fields', () => {
    // Missing grid field entirely - this fails strict schema
    expect(
      axisSpecToSvg({
        kind: 'cartesian',
        units: 1,
        axes: {
          showNumbers: false,
          showLabels: false,
          ticks: 0,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
        },
        elements: { points: [], graphs: [] },
      }),
    ).toBe('')
  })

  it('renders hole points with white fill', () => {
    const spec: AxisSpecV1 = {
      kind: 'cartesian',
      units: 1,
      grid: { enabled: false },
      axes: {
        showNumbers: false,
        showLabels: false,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      viewportMode: 'auto',
      elements: {
        points: [{ x: 3, y: 4, label: 'H', type: 'hole' }],
        graphs: [],
      },
    }
    const svg = axisSpecToSvg(spec)
    expect(svg).toContain('fill="#ffffff"')
  })

  it('renders dashed graphs correctly', () => {
    const spec: AxisSpecV1 = {
      kind: 'cartesian',
      units: 1,
      grid: { enabled: false },
      axes: {
        showNumbers: false,
        showLabels: false,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      viewportMode: 'auto',
      elements: {
        points: [],
        graphs: [
          {
            id: 'dashed',
            fn: 'x',
            style: 'dashed',
            thickness: 2,
            color: '#9333ea',
          },
        ],
      },
    }
    const svg = axisSpecToSvg(spec)
    expect(svg).toContain('stroke-dasharray="5,5"')
  })
})

describe('multiAxisToSvg', () => {
  it('renders empty array to empty string', () => {
    expect(multiAxisToSvg([])).toBe('')
  })

  it('returns empty string for non-array input', () => {
    expect(multiAxisToSvg(null)).toBe('')
    expect(multiAxisToSvg(undefined)).toBe('')
    expect(multiAxisToSvg('not an array')).toBe('')
  })

  it('renders single graph', () => {
    const result = multiAxisToSvg([{ axis: axisWithFunctionSpec }])
    expect(result).toContain('<svg')
    expect(result).toContain('</svg>')
  })

  it('renders multiple graphs concatenated', () => {
    const result = multiAxisToSvg([{ axis: axisWithFunctionSpec }, { axis: multiFunctionAxisSpec }])
    // Multiple SVGs concatenated
    const svgCount = (result.match(/<svg/g) || []).length
    expect(svgCount).toBeGreaterThanOrEqual(2)
  })

  it('skips invalid axis entries', () => {
    const result = multiAxisToSvg([
      { axis: axisWithFunctionSpec },
      { axis: {} },
      { axis: null },
      { axis: multiFunctionAxisSpec },
    ])
    // Should still render valid ones
    expect(result).toContain('<svg')
  })

  it('returns empty string when all entries are invalid', () => {
    expect(multiAxisToSvg([{ axis: {} }, { axis: null }])).toBe('')
  })
})

describe('Zod validation integration', () => {
  it('geometrySpecToSvg uses Zod validation', () => {
    // Missing required canvas field
    const invalidSpec = {
      kind: 'euclidean',
      elements: { points: [], lines: [], circles: [], angles: [] },
    }
    expect(geometrySpecToSvg(invalidSpec)).toBe('')
  })

  it('axisSpecToSvg uses Zod validation', () => {
    // Missing required grid field
    const invalidSpec = {
      kind: 'cartesian',
      units: 1,
      axes: {
        showNumbers: false,
        showLabels: false,
        ticks: 0,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      elements: { points: [], graphs: [] },
    }
    expect(axisSpecToSvg(invalidSpec)).toBe('')
  })
})
