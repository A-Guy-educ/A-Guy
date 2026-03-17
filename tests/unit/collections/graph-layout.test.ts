/**
 * Unit Tests: Graph Layout Feature
 *
 * Tests for the layout field added to QuestionGeometryBlock and QuestionAxisBlock.
 * These tests validate:
 * 1. Schema accepts layout field with valid values
 * 2. Schema defaults layout to 'textRight' when omitted
 * 3. Schema rejects invalid layout values
 * 4. Default block factories produce layout: 'textRight'
 */

import { ContentBlockSchema } from '@/server/payload/collections/Exercises/schemas'
import { ExerciseBlockDefaults } from '@/server/payload/collections/Exercises/defaults'
import { describe, expect, it } from 'vitest'

describe('Graph Layout Field in Schemas', () => {
  describe('QuestionGeometryBlockSchema with layout field', () => {
    it('accepts geometry block with layout field set to textLeft', () => {
      const geometryBlock = {
        id: 'g1',
        type: 'question_geometry' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Find angle ABC',
        },
        layout: 'textLeft' as const,
        geometry: {
          kind: 'euclidean' as const,
          canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
          elements: {
            points: [
              { name: 'A', x: 150, y: 100, position: 'tl', visible: true },
              { name: 'B', x: 350, y: 100, position: 'tr', visible: true },
              { name: 'C', x: 250, y: 300, position: 'b', visible: true },
            ],
            lines: [],
            circles: [],
            angles: [],
          },
          interactionSpec: {
            enabled: false,
            toolsAllowed: [],
            evaluation: { mode: 'none' },
          },
        },
      }

      const result = ContentBlockSchema.parse(geometryBlock)
      expect((result as any).layout).toBe('textLeft')
    })

    it('accepts geometry block with layout field set to textAbove', () => {
      const geometryBlock = {
        id: 'g1',
        type: 'question_geometry' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Find angle ABC',
        },
        layout: 'textAbove' as const,
        geometry: {
          kind: 'euclidean' as const,
          canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
          elements: {
            points: [{ name: 'A', x: 150, y: 100, position: 'tl', visible: true }],
            lines: [],
            circles: [],
            angles: [],
          },
          interactionSpec: {
            enabled: false,
            toolsAllowed: [],
            evaluation: { mode: 'none' },
          },
        },
      }

      const result = ContentBlockSchema.parse(geometryBlock)
      expect((result as any).layout).toBe('textAbove')
    })

    it('defaults layout to textRight when omitted', () => {
      const geometryBlock = {
        id: 'g1',
        type: 'question_geometry' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Find angle ABC',
        },
        geometry: {
          kind: 'euclidean' as const,
          canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
          elements: {
            points: [{ name: 'A', x: 150, y: 100, position: 'tl', visible: true }],
            lines: [],
            circles: [],
            angles: [],
          },
          interactionSpec: {
            enabled: false,
            toolsAllowed: [],
            evaluation: { mode: 'none' },
          },
        },
      }

      const result = ContentBlockSchema.parse(geometryBlock)
      expect((result as any).layout).toBe('textRight')
    })

    it('rejects geometry block with invalid layout value', () => {
      const invalidGeometryBlock = {
        id: 'g1',
        type: 'question_geometry' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Find angle ABC',
        },
        layout: 'invalidValue' as any,
        geometry: {
          kind: 'euclidean' as const,
          canvas: { width: 600, height: 400, background: '#ffffff', grid: true },
          elements: {
            points: [],
            lines: [],
            circles: [],
            angles: [],
          },
          interactionSpec: {
            enabled: false,
            toolsAllowed: [],
            evaluation: { mode: 'none' },
          },
        },
      }

      expect(() => ContentBlockSchema.parse(invalidGeometryBlock)).toThrow()
    })
  })

  describe('QuestionAxisBlockSchema with layout field', () => {
    it('accepts axis block with layout field set to textRight', () => {
      const axisBlock = {
        id: 'a1',
        type: 'question_axis' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Plot the function f(x) = x^2',
        },
        layout: 'textRight' as const,
        axis: {
          kind: 'cartesian' as const,
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
          elements: { points: [], graphs: [] },
        },
      }

      const result = ContentBlockSchema.parse(axisBlock)
      expect((result as any).layout).toBe('textRight')
    })

    it('accepts axis block with layout field set to textBelow', () => {
      const axisBlock = {
        id: 'a1',
        type: 'question_axis' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Plot the function',
        },
        layout: 'textBelow' as const,
        axis: {
          kind: 'cartesian' as const,
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
          elements: { points: [], graphs: [] },
        },
      }

      const result = ContentBlockSchema.parse(axisBlock)
      expect((result as any).layout).toBe('textBelow')
    })

    it('defaults layout to textRight when omitted', () => {
      const axisBlock = {
        id: 'a1',
        type: 'question_axis' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Plot the function',
        },
        axis: {
          kind: 'cartesian' as const,
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
          elements: { points: [], graphs: [] },
        },
      }

      const result = ContentBlockSchema.parse(axisBlock)
      expect((result as any).layout).toBe('textRight')
    })

    it('rejects axis block with invalid layout value', () => {
      const invalidAxisBlock = {
        id: 'a1',
        type: 'question_axis' as const,
        prompt: {
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'Plot the function',
        },
        layout: 'not-a-layout' as any,
        axis: {
          kind: 'cartesian' as const,
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
          elements: { points: [], graphs: [] },
        },
      }

      expect(() => ContentBlockSchema.parse(invalidAxisBlock)).toThrow()
    })
  })
})

describe('Graph Layout in Default Block Factories', () => {
  it('question_geometry factory creates block with layout textRight', () => {
    const block = ExerciseBlockDefaults['question_geometry']()
    expect((block as any).layout).toBe('textRight')
  })

  it('question_axis factory creates block with layout textRight', () => {
    const block = ExerciseBlockDefaults['question_axis']()
    expect((block as any).layout).toBe('textRight')
  })
})
