import { AxisSpecV1Schema } from '@/infra/contracts'
import { describe, expect, it } from 'vitest'

describe('AxisSpecV1Schema', () => {
  it('validates complete axis spec with all features', () => {
    const validSpec = {
      kind: 'cartesian',
      units: 1,
      grid: { enabled: true, color: '#ccc' },
      axes: {
        axisColor: '#000',
        numberColor: '#333',
        labelColor: '#000',
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
      elements: {
        points: [
          {
            x: 2,
            y: 3,
            type: 'point',
            label: 'P',
            labelPosition: 'tr',
            color: 'red',
          },
        ],
        graphs: [
          {
            id: 'g1',
            fn: 'x^2',
            style: 'solid',
            thickness: 2,
            color: 'blue',
            range: { fromX: -5, toX: 5 },
            paint: {
              underGraph: [{ fromX: 0, toX: 2, fillColor: 'rgba(0,0,255,0.2)' }],
            },
          },
        ],
        asymptotesVertical: [0],
        asymptotesHorizontal: [1],
      },
      interactionSpec: {
        enabled: false,
        toolsAllowed: [],
        evaluation: { mode: 'none' },
      },
    }
    expect(() => AxisSpecV1Schema.parse(validSpec)).not.toThrow()
  })

  it('rejects axis spec with missing required fields', () => {
    const invalidSpec = {
      kind: 'cartesian',
      // Missing units
      grid: { enabled: true },
      axes: {
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      elements: {
        points: [],
        graphs: [],
      },
    }
    expect(() => AxisSpecV1Schema.parse(invalidSpec)).toThrow()
  })

  it('rejects axis spec with invalid graph (missing fn)', () => {
    const invalidSpec = {
      kind: 'cartesian',
      units: 1,
      grid: { enabled: true },
      axes: {
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      elements: {
        points: [],
        graphs: [
          {
            id: 'g1',
            // Missing fn
            style: 'solid',
            thickness: 1,
          },
        ],
      },
    }
    expect(() => AxisSpecV1Schema.parse(invalidSpec)).toThrow()
  })

  it('rejects axis spec with zero or negative units', () => {
    const invalidSpec = {
      kind: 'cartesian',
      units: 0, // Invalid
      grid: { enabled: true },
      axes: {
        showNumbers: true,
        showLabels: true,
        ticks: 1,
        labels: { x: 'x', y: 'y' },
        origin: { x: 0, y: 0 },
      },
      elements: {
        points: [],
        graphs: [],
      },
    }
    expect(() => AxisSpecV1Schema.parse(invalidSpec)).toThrow()
  })
})
