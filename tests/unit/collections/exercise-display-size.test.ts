/**
 * Unit Test: Exercise Display Size Schema Validation
 *
 * Tests that QuestionAxisBlockSchema accepts displaySize field.
 * This is part of the fix for issue #813 (control graph display size in exercises).
 */

import { describe, expect, it } from 'vitest'
import { QuestionAxisBlockSchema } from '@/server/payload/collections/Exercises/schemas'

describe('QuestionAxisBlockSchema displaySize field', () => {
  // Helper to create a minimal valid axis block
  const createValidAxisBlock = (overrides = {}) => ({
    id: 'test-axis-1',
    type: 'question_axis' as const,
    prompt: {
      type: 'rich_text' as const,
      format: 'md-math-v1' as const,
      value: 'Test question about the graph',
    },
    axis: {
      kind: 'cartesian' as const,
      units: 1,
      grid: { enabled: true },
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
    ...overrides,
  })

  describe('1.1: Schema accepts displaySize field with valid values', () => {
    it('given valid axis block with displaySize="small", then schema.parse() should succeed', () => {
      const block = createValidAxisBlock({ displaySize: 'small' })
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
    })

    it('given valid axis block with displaySize="medium", then schema.parse() should succeed', () => {
      const block = createValidAxisBlock({ displaySize: 'medium' })
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
    })

    it('given valid axis block with displaySize="large", then schema.parse() should succeed', () => {
      const block = createValidAxisBlock({ displaySize: 'large' })
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
    })

    it('given valid axis block with displaySize="full", then schema.parse() should succeed', () => {
      const block = createValidAxisBlock({ displaySize: 'full' })
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
    })
  })

  describe('1.2: Schema defaults displaySize to "full" when omitted', () => {
    it('given valid axis block without displaySize, then parsed result should have displaySize="full"', () => {
      const block = createValidAxisBlock()
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.displaySize).toBe('full')
      }
    })
  })

  describe('1.3: Schema rejects invalid displaySize values', () => {
    it('given axis block with displaySize="invalid", then schema.parse() should fail', () => {
      const block = createValidAxisBlock({ displaySize: 'invalid' })
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(false)
    })

    it('given axis block with displaySize="", then schema.parse() should fail', () => {
      const block = createValidAxisBlock({ displaySize: '' })
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(false)
    })

    it('given axis block with displaySize="FULL", then schema.parse() should fail (case-sensitive)', () => {
      const block = createValidAxisBlock({ displaySize: 'FULL' })
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(false)
    })
  })
})
