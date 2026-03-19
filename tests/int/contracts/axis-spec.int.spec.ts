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

  describe('tickPosition field', () => {
    it('validates axis spec with tickPosition field - inverted X', () => {
      const validSpec = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
          tickPosition: { x: 'inverted', y: 'default' },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }
      expect(() => AxisSpecV1Schema.parse(validSpec)).not.toThrow()
    })

    it('validates axis spec with tickPosition field - inverted Y', () => {
      const validSpec = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
          tickPosition: { x: 'default', y: 'inverted' },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }
      expect(() => AxisSpecV1Schema.parse(validSpec)).not.toThrow()
    })

    it('validates axis spec with tickPosition field - both inverted', () => {
      const validSpec = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
          tickPosition: { x: 'inverted', y: 'inverted' },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }
      expect(() => AxisSpecV1Schema.parse(validSpec)).not.toThrow()
    })

    it('validates axis spec without tickPosition (backward compatibility)', () => {
      const validSpec = {
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
          graphs: [],
        },
      }
      // Should not throw - tickPosition is optional
      expect(() => AxisSpecV1Schema.parse(validSpec)).not.toThrow()
    })

    it('rejects invalid tickPosition X value', () => {
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
          tickPosition: { x: 'invalid', y: 'default' },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }
      expect(() => AxisSpecV1Schema.parse(invalidSpec)).toThrow()
    })

    it('rejects invalid tickPosition Y value', () => {
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
          tickPosition: { x: 'default', y: 'upside_down' },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }
      expect(() => AxisSpecV1Schema.parse(invalidSpec)).toThrow()
    })

    it('defaults missing x in tickPosition to default', () => {
      const spec = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
          tickPosition: { y: 'inverted' },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }
      const result = AxisSpecV1Schema.parse(spec)
      expect(result.axes.tickPosition?.x).toBe('default')
      expect(result.axes.tickPosition?.y).toBe('inverted')
    })

    it('defaults missing y in tickPosition to default', () => {
      const spec = {
        kind: 'cartesian',
        units: 1,
        grid: { enabled: true },
        axes: {
          showNumbers: true,
          showLabels: true,
          ticks: 1,
          labels: { x: 'x', y: 'y' },
          origin: { x: 0, y: 0 },
          tickPosition: { x: 'inverted' },
        },
        elements: {
          points: [],
          graphs: [],
        },
      }
      const result = AxisSpecV1Schema.parse(spec)
      expect(result.axes.tickPosition?.x).toBe('inverted')
      expect(result.axes.tickPosition?.y).toBe('default')
    })
  })

  // Tests for FR-008: Viewport Schema Extension
  describe('viewportMode field', () => {
    it('defaults to auto when viewportMode is omitted (backward compatibility)', () => {
      const specWithoutViewportMode = {
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
          graphs: [],
        },
      }
      const result = AxisSpecV1Schema.parse(specWithoutViewportMode)
      expect(result.viewportMode).toBe('auto')
    })

    it('accepts viewportMode: auto', () => {
      const specWithAutoMode = {
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
        viewportMode: 'auto',
        elements: {
          points: [],
          graphs: [],
        },
      }
      const result = AxisSpecV1Schema.parse(specWithAutoMode)
      expect(result.viewportMode).toBe('auto')
    })

    it('accepts viewportMode: manual', () => {
      const specWithManualMode = {
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
        viewportMode: 'manual',
        viewport: { xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
        elements: {
          points: [],
          graphs: [],
        },
      }
      const result = AxisSpecV1Schema.parse(specWithManualMode)
      expect(result.viewportMode).toBe('manual')
    })

    it('rejects invalid viewportMode value', () => {
      const specWithInvalidMode = {
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
        viewportMode: 'zoom', // Invalid - not in enum
        elements: {
          points: [],
          graphs: [],
        },
      }
      expect(() => AxisSpecV1Schema.parse(specWithInvalidMode)).toThrow()
    })
  })
})
