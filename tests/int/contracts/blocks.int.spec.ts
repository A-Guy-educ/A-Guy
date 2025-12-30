import { describe, expect, it } from 'vitest'
import { ExerciseBlockSchema } from '@/contracts'

describe('ExerciseBlockSchema', () => {
  it('validates rich_text block', () => {
    const validBlock = {
      id: 'b1',
      type: 'rich_text',
      format: 'md-math-v1',
      value: 'Solve: $2x^2+3=11$',
    }
    expect(() => ExerciseBlockSchema.parse(validBlock)).not.toThrow()
  })

  it('rejects rich_text block with empty value', () => {
    const invalidBlock = {
      id: 'b1',
      type: 'rich_text',
      format: 'md-math-v1',
      value: '',
    }
    expect(() => ExerciseBlockSchema.parse(invalidBlock)).toThrow()
  })

  it('validates table block', () => {
    const validBlock = {
      id: 't1',
      type: 'table',
      headers: ['x', 'y'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
      showBorders: true,
      showHeader: true,
      columnAlignment: ['left', 'right'],
    }
    expect(() => ExerciseBlockSchema.parse(validBlock)).not.toThrow()
  })

  it('rejects table block with row/header length mismatch', () => {
    const invalidBlock = {
      id: 't1',
      type: 'table',
      headers: ['x', 'y'], // 2 columns
      rows: [
        ['1', '2', '3'], // 3 columns - mismatch!
      ],
      showBorders: true,
      showHeader: true,
      columnAlignment: ['left', 'right'],
    }
    expect(() => ExerciseBlockSchema.parse(invalidBlock)).toThrow(/has 3 columns but headers has 2/)
  })

  it('validates svg block', () => {
    const validBlock = {
      id: 's1',
      type: 'svg',
      svg: '<svg><circle cx="50" cy="50" r="40"/></svg>',
    }
    expect(() => ExerciseBlockSchema.parse(validBlock)).not.toThrow()
  })

  it('rejects svg block with empty svg', () => {
    const invalidBlock = {
      id: 's1',
      type: 'svg',
      svg: '',
    }
    expect(() => ExerciseBlockSchema.parse(invalidBlock)).toThrow()
  })

  it('validates axis_system block', () => {
    const validBlock = {
      id: 'a1',
      type: 'axis_system',
      specVersion: 1,
      spec: {
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
              fn: '2*x^2+3',
              style: 'solid',
              thickness: 1,
            },
          ],
        },
      },
    }
    expect(() => ExerciseBlockSchema.parse(validBlock)).not.toThrow()
  })

  it('rejects axis_system block with wrong specVersion', () => {
    const invalidBlock = {
      id: 'a1',
      type: 'axis_system',
      specVersion: 2, // Wrong version
      spec: {
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
      },
    }
    expect(() => ExerciseBlockSchema.parse(invalidBlock)).toThrow()
  })

  it('validates geometry block', () => {
    const validBlock = {
      id: 'g1',
      type: 'geometry',
      specVersion: 1,
      spec: {
        kind: 'euclidean',
        canvas: { width: 600, height: 400 },
        elements: {
          points: [
            { name: 'A', x: 100, y: 100 },
            { name: 'B', x: 200, y: 200 },
          ],
          lines: [{ from: 'A', to: 'B', style: 'solid' }],
          circles: [],
          angles: [],
        },
      },
    }
    expect(() => ExerciseBlockSchema.parse(validBlock)).not.toThrow()
  })

  it('rejects unknown block type', () => {
    const invalidBlock = {
      id: 'b1',
      type: 'unknown_type',
      value: 'something',
    }
    expect(() => ExerciseBlockSchema.parse(invalidBlock)).toThrow()
  })

  it('rejects block with unknown keys (strict mode)', () => {
    const invalidBlock = {
      id: 'b1',
      type: 'rich_text',
      format: 'md-math-v1',
      value: 'Test',
      unknownField: 'should be rejected',
    }
    expect(() => ExerciseBlockSchema.parse(invalidBlock)).toThrow()
  })
})
