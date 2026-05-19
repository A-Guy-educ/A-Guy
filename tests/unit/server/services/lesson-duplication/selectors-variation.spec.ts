/**
 * Unit tests for issue #1665: Smarter section selector for variations
 *
 * Tests that selectSectionsForVariation prioritizes question blocks over
 * context blocks (rich_text, latex) when selecting a subset of blocks.
 *
 * The current selectSectionsForVariation uses scaling-random selection that ignores
 * block type, potentially dropping all question blocks in favor of context.
 *
 * Acceptance criteria (from issue #1665):
 * - Always include at least one question_* block in the picked set
 * - Prefer keeping the first rich_text/latex block as context, then fill
 *   with question blocks
 * - If total <= 5 nothing changes
 * - Preserve source order in output
 * - All-context exercises yield 5 context blocks unchanged (edge case)
 */
import { describe, expect, it } from 'vitest'

// Import the new variation-aware selector
import { selectSectionsForVariation } from '@/server/services/lesson-duplication/selectors'

// ---------------------------------------------------------------------------
// Block type helpers for test clarity
// ---------------------------------------------------------------------------

type BlockType =
  | 'rich_text'
  | 'latex'
  | 'question_select'
  | 'question_free_response'
  | 'question_table'
  | 'question_matching'
  | 'question_geometry'
  | 'question_axis'
  | 'question_multi_axis'
  | 'svg'
  | 'html'
  | 'media'

interface TestBlock {
  id: string
  type: BlockType
}

// Helper to create blocks with readable IDs for debugging
function richText(id: string): TestBlock {
  return { id, type: 'rich_text' }
}
function latex(id: string): TestBlock {
  return { id, type: 'latex' }
}
function question(id: string, variant: BlockType = 'question_select'): TestBlock {
  return { id, type: variant }
}

// ---------------------------------------------------------------------------
// Bug reproduction tests
// These tests assert the EXPECTED correct behavior which the current
// selectSectionsForVariation implementation FAILS to provide.
// ---------------------------------------------------------------------------

describe('selectSectionsForVariation (issue #1665)', () => {
  describe('should always include at least one question block', () => {
    /**
     * This is the core bug reproduction. When context blocks (rich_text, latex)
     * are interspersed with question blocks, the scaling-random algorithm
     * blindly picks evenly-spaced blocks without regard to type.
     *
     * With 5 context + 5 questions interspersed:
     * - Some seeds return 0 questions (all picked blocks are context!)
     * - Many seeds return only 1-2 questions
     *
     * This violates the acceptance criteria: "always include at least one
     * question_* block in the picked set"
     */
    it('BUG REPRO: interspersing context with questions causes 0-2 question picks', () => {
      // Realistic exercise shape: context and questions interspersed
      const blocks: TestBlock[] = [
        richText('r1'),
        question('q1'),
        richText('r2'),
        question('q2'),
        latex('l1'),
        question('q3'),
        richText('r3'),
        question('q4'),
        latex('l2'),
        question('q5'),
      ]

      // Try seeds 1-200 to find distributions
      const distributions = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (let seed = 1; seed <= 200; seed++) {
        const result = selectSectionsForVariation(blocks, 5, seed)
        const questionCount = result.filter((b) => b.type.startsWith('question_')).length
        if (questionCount in distributions) {
          distributions[questionCount as keyof typeof distributions]++
        }
      }

      // BUG: The current implementation produces this distribution:
      // 0 questions: ~7 seeds, 1 question: ~36 seeds, 2 questions: ~66 seeds
      //
      // This is WRONG. The acceptance criteria requires at least 1 question.
      // The assertion below FAILS because of the bug:
      expect(distributions[0]).toBe(0) // Should never pick 0 questions
      expect(distributions[1]).toBe(0) // Should rarely pick only 1 question
    })

    it('BUG: with seed 42, interspersed blocks may return only 1 question', () => {
      // Specific seed that demonstrates the bug
      const blocks: TestBlock[] = [
        richText('r1'),
        question('q1'),
        richText('r2'),
        question('q2'),
        latex('l1'),
        question('q3'),
        richText('r3'),
        question('q4'),
        latex('l2'),
        question('q5'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 42)

      expect(result).toHaveLength(5)

      // ACCEPTANCE CRITERION: Must include at least one question block
      // BUG: This FAILS because selectSectionsForVariation ignores block type
      const questionCount = result.filter((b) => b.type.startsWith('question_')).length
      expect(questionCount).toBeGreaterThanOrEqual(1)

      // PREFERRED: Should get 1 context + 4 questions for this shape
      expect(questionCount).toBeGreaterThanOrEqual(4)
    })

    it('all questions (10 questions): should select 5 questions', () => {
      const blocks: TestBlock[] = [
        question('q1'),
        question('q2'),
        question('q3'),
        question('q4'),
        question('q5'),
        question('q6'),
        question('q7'),
        question('q8'),
        question('q9'),
        question('q10'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 137)

      expect(result).toHaveLength(5)
      // All 5 should be questions
      const questionCount = result.filter((b) => b.type.startsWith('question_')).length
      expect(questionCount).toBe(5)
    })
  })

  describe('BUG: should prefer first context block as intro', () => {
    it('includes first rich_text when available', () => {
      // Setup: intro rich_text, then lots of questions, then latex
      const blocks: TestBlock[] = [
        richText('intro'),
        question('q1'),
        question('q2'),
        question('q3'),
        question('q4'),
        question('q5'),
        latex('math'),
        question('q6'),
        question('q7'),
        question('q8'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 137)

      // First rich_text should be included
      expect(result[0].type).toBe('rich_text')

      // Total 5 blocks: should have intro + 4 questions ideally
      expect(result).toHaveLength(5)

      // BUG: May fail because algorithm doesn't prioritize questions
      const questionCount = result.filter((b) => b.type.startsWith('question_')).length
      expect(questionCount).toBeGreaterThanOrEqual(4)
    })

    it('includes first latex when no rich_text exists', () => {
      const blocks: TestBlock[] = [
        latex('math1'),
        latex('math2'),
        question('q1'),
        question('q2'),
        question('q3'),
        question('q4'),
        question('q5'),
        question('q6'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 137)

      // First latex should be included
      expect(result[0].type).toBe('latex')

      expect(result).toHaveLength(5)
      const questionCount = result.filter((b) => b.type.startsWith('question_')).length
      // BUG: May not include enough questions
      expect(questionCount).toBeGreaterThanOrEqual(4)
    })
  })

  describe('source order preservation', () => {
    it('output blocks maintain source order', () => {
      const blocks: TestBlock[] = [
        question('q1'),
        richText('intro'),
        question('q2'),
        question('q3'),
        latex('math'),
        question('q4'),
        question('q5'),
        question('q6'),
        question('q7'),
        question('q8'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 137)

      // Extract source indices to verify order
      const sourceOrder = blocks.map((b, i) => ({ id: b.id, index: i }))
      const resultIndices = result.map((b) => sourceOrder.find((s) => s.id === b.id)!.index)

      // Verify strictly increasing
      for (let i = 1; i < resultIndices.length; i++) {
        expect(resultIndices[i]).toBeGreaterThan(resultIndices[i - 1])
      }
    })
  })

  describe('edge cases', () => {
    it('returns all blocks unchanged when length <= 5', () => {
      const blocks: TestBlock[] = [
        richText('intro'),
        question('q1'),
        question('q2'),
        latex('math'),
        question('q3'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 137)

      expect(result).toHaveLength(5)
      expect(result).toEqual(blocks)
    })

    it('handles exactly 6 blocks (1 intro + 5 questions) -> 5 blocks', () => {
      const blocks: TestBlock[] = [
        richText('intro'),
        question('q1'),
        question('q2'),
        question('q3'),
        question('q4'),
        question('q5'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 137)

      expect(result).toHaveLength(5)
      // Should include the intro and 4 questions (dropping 1 question)
      const questionCount = result.filter((b) => b.type.startsWith('question_')).length
      // BUG: May not preserve intro
      expect(questionCount).toBeGreaterThanOrEqual(4)
    })

    it('all-context: returns 5 context blocks unchanged', () => {
      // Edge case: no question blocks at all
      const blocks: TestBlock[] = [
        richText('intro1'),
        latex('math1'),
        richText('intro2'),
        latex('math2'),
        richText('intro3'),
        latex('math3'),
        richText('intro4'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 137)

      expect(result).toHaveLength(5)
      // All should be context blocks since no questions exist
      const questionCount = result.filter((b) => b.type.startsWith('question_')).length
      expect(questionCount).toBe(0)
    })

    it('returns empty array for empty input', () => {
      const result = selectSectionsForVariation([], 5, 137)
      expect(result).toEqual([])
    })

    it('returns empty array when max is zero or negative', () => {
      const blocks: TestBlock[] = [question('q1'), question('q2')]
      expect(selectSectionsForVariation(blocks, 0, 137)).toEqual([])
      expect(selectSectionsForVariation(blocks, -1, 137)).toEqual([])
    })
  })

  describe('specific bug reproduction', () => {
    it('BUG: seed 7 with intersperced blocks drops questions', () => {
      // This specific test case demonstrates the bug with a known seed
      const blocks: TestBlock[] = [
        richText('r1'),
        question('q1'),
        richText('r2'),
        question('q2'),
        latex('l1'),
        question('q3'),
        richText('r3'),
        question('q4'),
        latex('l2'),
        question('q5'),
      ]

      const result = selectSectionsForVariation(blocks, 5, 7)

      // Verify we got 5 blocks
      expect(result).toHaveLength(5)

      // BUG: This assertion FAILS because selectSectionsForVariation doesn't prioritize questions
      // The acceptance criteria states: "always include at least one question_* block"
      const questionCount = result.filter((b) => b.type.startsWith('question_')).length
      expect(questionCount).toBeGreaterThanOrEqual(1)

      // PREFERRED: Should get 1 context + 4 questions
      expect(questionCount).toBeGreaterThanOrEqual(4)
    })
  })
})
