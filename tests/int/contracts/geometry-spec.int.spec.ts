import { GeometrySpecV1Schema } from '@/infra/contracts'
import { describe, expect, it } from 'vitest'

describe('GeometrySpecV1Schema', () => {
  it('validates complete geometry spec', () => {
    const validSpec = {
      kind: 'euclidean',
      canvas: { width: 600, height: 400, background: '#fff', grid: true },
      elements: {
        points: [
          { name: 'A', x: 100, y: 100, position: 'tl', fontSize: 14, visible: true },
          { name: 'B', x: 200, y: 200 },
          { name: 'C', x: 150, y: 250 },
        ],
        lines: [
          {
            from: 'A',
            to: 'B',
            style: 'solid',
            thickness: 2,
            color: '#000',
            label: { value: 'AB', position: 't', fontSize: 12 },
          },
        ],
        circles: [{ center: 'A', through: 'B', style: 'solid', color: 'blue' }],
        angles: [
          {
            center: 'B',
            ray1: 'A',
            ray2: 'C',
            arcRadius: 30,
            color: 'green',
            style: 'arc',
            label: { value: '90°', position: 'inside', fontSize: 10 },
          },
        ],
        triangles: [
          {
            points: ['A', 'B', 'C'],
            style: 'solid',
            thickness: 1,
            color: '#000',
            fill: 'rgba(255,0,0,0.1)',
          },
        ],
      },
    }
    expect(() => GeometrySpecV1Schema.parse(validSpec)).not.toThrow()
  })

  it('rejects geometry spec with invalid canvas', () => {
    const invalidSpec = {
      kind: 'euclidean',
      canvas: { width: -100, height: 400 }, // Negative width
      elements: {
        points: [],
        lines: [],
        circles: [],
        angles: [],
      },
    }
    expect(() => GeometrySpecV1Schema.parse(invalidSpec)).toThrow()
  })

  it('rejects triangle with wrong number of points', () => {
    const invalidSpec = {
      kind: 'euclidean',
      canvas: { width: 600, height: 400 },
      elements: {
        points: [
          { name: 'A', x: 0, y: 0 },
          { name: 'B', x: 100, y: 0 },
        ],
        lines: [],
        circles: [],
        angles: [],
        triangles: [
          {
            points: ['A', 'B'], // Only 2 points, needs 3
            style: 'solid',
          },
        ],
      },
    }
    expect(() => GeometrySpecV1Schema.parse(invalidSpec)).toThrow()
  })
})
