/**
 * @fileType unit-test
 * @domain exercises
 * @pattern schema-validation, display-size
 * @ai-summary Unit tests for displaySize field in QuestionAxisBlock schema
 */
import { describe, expect, it } from 'vitest'

import {
  QuestionAxisBlockSchema,
  ContentBlockSchema,
} from '@/server/payload/collections/Exercises/schemas'
import type { QuestionAxisBlock } from '@/server/payload/collections/Exercises/types'
import { ExerciseBlockDefaults } from '@/server/payload/collections/Exercises/defaults'

// Valid axis block base for testing
const validAxisBlockBase = {
  id: 'axis-1',
  type: 'question_axis' as const,
  prompt: {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: 'Graph the function:',
    mediaIds: [],
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
  hint: {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: '',
    mediaIds: [],
  },
  solution: {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: '',
    mediaIds: [],
  },
  fullSolution: {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value: '',
    mediaIds: [],
  },
}

describe('QuestionAxisBlockSchema displaySize field', () => {
  describe('Valid displaySize values', () => {
    it('should accept displaySize="small" (33%)', () => {
      const block = { ...validAxisBlockBase, displaySize: 'small' as const }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.displaySize).toBe('small')
      }
    })

    it('should accept displaySize="medium" (50%)', () => {
      const block = { ...validAxisBlockBase, displaySize: 'medium' as const }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.displaySize).toBe('medium')
      }
    })

    it('should accept displaySize="large" (75%)', () => {
      const block = { ...validAxisBlockBase, displaySize: 'large' as const }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.displaySize).toBe('large')
      }
    })

    it('should accept displaySize="full" (100%)', () => {
      const block = { ...validAxisBlockBase, displaySize: 'full' as const }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.displaySize).toBe('full')
      }
    })
  })

  describe('Backward compatibility', () => {
    it('should accept block without displaySize field (defaults to "full")', () => {
      // This is the key backward compatibility test - existing blocks without displaySize should work
      const block = { ...validAxisBlockBase }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
      if (result.success) {
        // Should default to 'full' when not specified
        expect(result.data.displaySize).toBe('full')
      }
    })

    it('should parse block without displaySize through ContentBlockSchema', () => {
      const block = { ...validAxisBlockBase }
      const result = ContentBlockSchema.safeParse(block)
      expect(result.success).toBe(true)
    })
  })

  describe('Invalid displaySize values', () => {
    it('should reject displaySize="tiny" (invalid value)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = { ...validAxisBlockBase, displaySize: 'tiny' as any }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(false)
    })

    it('should reject displaySize="medium-large" (invalid value)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = { ...validAxisBlockBase, displaySize: 'medium-large' as any }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(false)
    })

    it('should reject displaySize=50 (number, not string)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const block = { ...validAxisBlockBase, displaySize: 50 as any }
      const result = QuestionAxisBlockSchema.safeParse(block)
      expect(result.success).toBe(false)
    })
  })
})

describe('QuestionAxisBlock type', () => {
  it('should have displaySize as optional field in type definition', () => {
    // This tests TypeScript type inference
    const blockWithDisplaySize: QuestionAxisBlock = {
      ...validAxisBlockBase,
      displaySize: 'medium',
    }
    expect(blockWithDisplaySize.displaySize).toBe('medium')

    const blockWithoutDisplaySize: QuestionAxisBlock = {
      ...validAxisBlockBase,
    }
    // TypeScript should allow this without displaySize
    expect(blockWithoutDisplaySize.axis).toBeDefined()
  })
})

describe('ExerciseBlockDefaults question_axis factory', () => {
  it('should create axis block with displaySize="full" by default', () => {
    const defaultBlock = ExerciseBlockDefaults.question_axis() as QuestionAxisBlock
    expect(defaultBlock.displaySize).toBe('full')
  })

  it('should create axis block with required fields', () => {
    const defaultBlock = ExerciseBlockDefaults.question_axis() as QuestionAxisBlock
    expect(defaultBlock.type).toBe('question_axis')
    expect(defaultBlock.id).toBeDefined()
    expect(defaultBlock.axis).toBeDefined()
    expect(defaultBlock.axis.kind).toBe('cartesian')
  })
})

describe('ContentBlockSchema with displaySize', () => {
  it('should validate question_axis with displaySize through ContentBlockSchema union', () => {
    const block = { ...validAxisBlockBase, displaySize: 'small' as const }
    const result = ContentBlockSchema.safeParse(block)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('question_axis')
      // @ts-expect-error - accessing displaySize which may not be in the type yet
      expect(result.data.displaySize).toBe('small')
    }
  })

  it('should validate question_axis without displaySize through ContentBlockSchema union', () => {
    const block = { ...validAxisBlockBase }
    const result = ContentBlockSchema.safeParse(block)
    expect(result.success).toBe(true)
  })
})
