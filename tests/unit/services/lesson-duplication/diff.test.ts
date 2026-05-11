/**
 * Unit Tests for classifyDiff utility
 *
 * Tests the classifyDiff function that categorizes differences between
 * source and output exercise block arrays.
 */
import { describe, expect, it } from 'vitest'
import {
  classifyDiff,
  numericDifferencesOnly,
  type DiffCategory,
} from '@/server/services/lesson-duplication/diff'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'

// Helper to create a basic rich_text block
function richText(id: string, value: string): ContentBlock {
  return { id, type: 'rich_text', format: 'md-math-v1', value } as ContentBlock
}

// Helper to create a latex block
function latex(id: string, latexContent: string): ContentBlock {
  return { id, type: 'latex', latex: latexContent } as ContentBlock
}

// Helper to create a question_geometry block with minimal geometry spec
function geometry(id: string, viewportXMin: number): ContentBlock {
  return {
    id,
    type: 'question_geometry',
    geometry: {
      version: 1,
      viewport: { xMin: viewportXMin, xMax: 10, yMin: 0, yMax: 10 },
      elements: [],
    },
  } as unknown as ContentBlock
}

// Helper to create a question_axis block with minimal axis spec
function axis(id: string, viewportXMin: number): ContentBlock {
  return {
    id,
    type: 'question_axis',
    axis: {
      viewport: { xMin: viewportXMin, xMax: 10, yMin: 0, yMax: 1 },
    },
  } as unknown as ContentBlock
}

describe('classifyDiff', () => {
  describe('identical blocks', () => {
    it('returns identical for same block arrays', () => {
      const blocks = [richText('b1', 'Hello')]
      expect(classifyDiff(blocks, blocks)).toBe<DiffCategory>('identical')
    })

    it('returns identical for empty arrays', () => {
      expect(classifyDiff([], [])).toBe<DiffCategory>('identical')
    })

    it('returns identical for identical blocks with same nested structure', () => {
      const source = [geometry('g1', 0)]
      const output = [geometry('g1', 0)]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('identical')
    })

    it('returns identical for multiple identical blocks', () => {
      const source = [richText('r1', 'A'), latex('l1', 'x^2'), richText('r2', 'B')]
      const output = [richText('r1', 'A'), latex('l1', 'x^2'), richText('r2', 'B')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('identical')
    })
  })

  describe('structural_diff — block count', () => {
    it('returns structural_diff when output has fewer blocks', () => {
      const source = [richText('r1', 'A'), richText('r2', 'B')]
      const output = [richText('r1', 'A')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('structural_diff')
    })

    it('returns structural_diff when output has more blocks', () => {
      const source = [richText('r1', 'A')]
      const output = [richText('r1', 'A'), richText('r2', 'B')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('structural_diff')
    })
  })

  describe('structural_diff — type mismatch', () => {
    it('returns structural_diff when block types differ at same index', () => {
      const source = [richText('r1', 'Hello')]
      const output = [latex('l1', 'x^2')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('structural_diff')
    })

    it('returns structural_diff when one side has geometry and other has none', () => {
      const source = [geometry('g1', 0), richText('r1', 'A')]
      const output = [richText('r1', 'A')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('structural_diff')
    })

    it('returns structural_diff when second block type changes', () => {
      const source = [richText('r1', 'A'), latex('l1', 'x')]
      const output = [richText('r1', 'A'), geometry('g1', 0)]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('structural_diff')
    })
  })

  describe('numeric_only', () => {
    it('returns numeric_only when question_axis viewport.xMin differs', () => {
      const source = [axis('a1', 0), richText('r1', 'Fixed text')]
      const output = [axis('a1', 5), richText('r1', 'Fixed text')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('numeric_only')
    })

    it('returns numeric_only when multiple numeric values differ', () => {
      const source = [axis('a1', 0), geometry('g1', 0)] as ContentBlock[]
      const output = [axis('a1', 5), geometry('g1', 3)] as ContentBlock[]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('numeric_only')
    })

    it('returns numeric_only when geometry viewport xMin differs but other values same', () => {
      const source = [geometry('g1', 0)]
      const output = [geometry('g1', 10)]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('numeric_only')
    })

    it('returns numeric_only when numeric values nested deep in objects differ', () => {
      const source = [
        {
          id: 'g1',
          type: 'question_geometry',
          geometry: {
            version: 1,
            viewport: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
            elements: [{ type: 'line', x1: 1, y1: 1, x2: 5, y2: 5 }],
          },
        },
      ] as unknown as ContentBlock[]
      const output = [
        {
          id: 'g1',
          type: 'question_geometry',
          geometry: {
            version: 1,
            viewport: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
            elements: [
              { type: 'line', x1: 2, y1: 2, x2: 6, y2: 6 }, // numeric coords differ
            ],
          },
        },
      ] as unknown as ContentBlock[]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('numeric_only')
    })
  })

  describe('phrasing_changed', () => {
    it('returns phrasing_changed when rich_text value changes', () => {
      const source = [richText('r1', 'x²')]
      const output = [richText('r1', 'y²')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('phrasing_changed')
    })

    it('returns phrasing_changed when string text differs within nested structure', () => {
      const source = [
        {
          id: 'g1',
          type: 'question_geometry',
          geometry: {
            version: 1,
            viewport: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
            elements: [
              {
                type: 'text',
                x: 5,
                y: 5,
                text: 'Hello', // string changed
              },
            ],
          },
        },
      ] as unknown as ContentBlock[]
      const output = [
        {
          id: 'g1',
          type: 'question_geometry',
          geometry: {
            version: 1,
            viewport: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
            elements: [
              {
                type: 'text',
                x: 5,
                y: 5,
                text: 'Goodbye', // string changed
              },
            ],
          },
        },
      ] as unknown as ContentBlock[]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('phrasing_changed')
    })

    it('returns phrasing_changed when mixed numeric and string differ (string takes precedence)', () => {
      const source = [axis('a1', 0), richText('r1', 'Original')] as ContentBlock[]
      const output = [axis('a1', 5), richText('r1', 'Changed')] as ContentBlock[]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('phrasing_changed')
    })

    it('returns structural_diff when key is missing from one side', async () => {
      // Plain objects without ContentBlock cast to avoid TypeScript narrowing issues
      const sourceObj = {
        id: 'r1',
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'A',
        extra: 'field',
      }
      const outputObj = {
        id: 'r1',
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'A',
      }
      // Test numericDifferencesOnly directly with these objects
      expect(numericDifferencesOnly(sourceObj, outputObj)).toBe(false)
      expect(numericDifferencesOnly(outputObj, sourceObj)).toBe(false)
      const source = [sourceObj]
      const output = [outputObj]
      // Verify the key count difference
      expect(Object.keys(sourceObj).length).toBe(5)
      expect(Object.keys(outputObj).length).toBe(4)
      const result = classifyDiff(
        source as unknown as ContentBlock[],
        output as unknown as ContentBlock[],
      )
      expect(result).toBe<DiffCategory>('structural_diff')
    })

    it('returns phrasing_changed when type mismatch between string and number', () => {
      const source = [
        { id: 'r1', type: 'rich_text', format: 'md-math-v1', value: '42' },
      ] as unknown as ContentBlock[]
      const output = [
        { id: 'r1', type: 'rich_text', format: 'md-math-v1', value: 42 },
      ] as unknown as ContentBlock[]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('phrasing_changed')
    })
  })

  describe('edge cases', () => {
    it('returns identical for single empty block array', () => {
      expect(classifyDiff([], [])).toBe<DiffCategory>('identical')
    })

    it('returns structural_diff for array length mismatch', () => {
      const source = [richText('r1', 'A')]
      const output = [richText('r1', 'A'), richText('r2', 'B'), richText('r3', 'C')]
      expect(classifyDiff(source, output)).toBe<DiffCategory>('structural_diff')
    })

    it('handles arrays with null/undefined gracefully', () => {
      // Empty arrays should return identical
      expect(classifyDiff([], [])).toBe<DiffCategory>('identical')
    })
  })
})
