/**
 * Unit tests for src/server/services/lesson-duplication/strategies/algebraic-detector.ts
 *
 * Target: isPurelyAlgebraic() — pure function, no mocks, no I/O.
 */
import { describe, expect, it } from 'vitest'
import { isPurelyAlgebraic } from '@/server/services/lesson-duplication/strategies/algebraic-detector'
import type { ContentBlock, InlineRichText } from '@/server/payload/collections/Exercises/types'

// ---------------------------------------------------------------------------
// Factory helpers (mirroring structural.spec.ts patterns)
// ---------------------------------------------------------------------------

function makeRichText(value: string): InlineRichText {
  return { type: 'rich_text', format: 'md-math-v1', value, mediaIds: [] }
}

function makeAlgebraicMcq(
  promptValue: string,
  options: Array<{ id: string; value: string }> = [
    { id: 'a', value: '10' },
    { id: 'b', value: '12' },
    { id: 'c', value: '15' },
  ],
  correctOptionIds = ['a'],
): ContentBlock {
  return {
    id: 'mcq-1',
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    prompt: makeRichText(promptValue),
    answer: {
      multiSelect: false,
      options: options.map((o) => ({ id: o.id, content: makeRichText(o.value) })),
      correctOptionIds,
    },
    hint: makeRichText('Hint'),
    solution: makeRichText('Solution'),
    fullSolution: makeRichText('Full solution'),
  } as ContentBlock
}

function makeSvg(): ContentBlock {
  return {
    id: 'svg-1',
    type: 'svg',
    value: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    altText: undefined,
  } as ContentBlock
}

function makeTable(): ContentBlock {
  return {
    id: 'table-1',
    type: 'question_table',
    prompt: makeRichText('Fill the table'),
    table: {
      headers: ['A', 'B'],
      rowsData: [['1', '2']],
      showBorders: true,
      showHeader: true,
    },
    hint: makeRichText('Hint'),
    solution: makeRichText('Solution'),
    fullSolution: makeRichText('Full solution'),
  } as ContentBlock
}

function makeFreeResponse(promptValue: string): ContentBlock {
  return {
    id: 'fr-1',
    type: 'question_free_response',
    prompt: makeRichText(promptValue),
    answer: { acceptedAnswers: ['42'] },
    hint: makeRichText('Hint'),
    solution: makeRichText('Solution'),
    fullSolution: makeRichText('Full solution'),
  } as ContentBlock
}

function makeExercise(...blocks: ContentBlock[]) {
  return { id: 'ex-1', content: { blocks } } as unknown as import('@/payload-types').Exercise
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isPurelyAlgebraic', () => {
  describe('positive cases — algebraic expressions', () => {
    it('returns true for 2+3=?', () => {
      expect(isPurelyAlgebraic(makeExercise(makeAlgebraicMcq('2+3=?')))).toBe(true)
    })

    it('returns true for חשב: 5×4', () => {
      expect(isPurelyAlgebraic(makeExercise(makeAlgebraicMcq('חשב: 5×4')))).toBe(true)
    })

    it('returns true for 12-7 with decimals', () => {
      expect(isPurelyAlgebraic(makeExercise(makeAlgebraicMcq('12.5 + 7.3 =')))).toBe(true)
    })

    it('returns true for multiple operators (2+3×4)', () => {
      expect(isPurelyAlgebraic(makeExercise(makeAlgebraicMcq('2+3×4=')))).toBe(true)
    })

    it('returns true for free response algebraic expression', () => {
      expect(isPurelyAlgebraic(makeExercise(makeFreeResponse('פתור: 15 ÷ 3')))).toBe(true)
    })
  })

  describe('negative cases — structural disqualifiers', () => {
    it('returns false for SVG block present', () => {
      expect(isPurelyAlgebraic(makeExercise(makeSvg()))).toBe(false)
    })

    it('returns false for question_table block', () => {
      expect(isPurelyAlgebraic(makeExercise(makeTable()))).toBe(false)
    })
  })

  describe('negative cases — word problems and context', () => {
    it('returns false for Hebrew word problem (farm)', () => {
      expect(
        isPurelyAlgebraic(
          makeExercise(makeAlgebraicMcq('בחווה יש 5 תרנגולות ו-3 תרנגולים. כמה בעלי חיים יש?')),
        ),
      ).toBe(false)
    })

    it('returns false for Hebrew word problem (cars)', () => {
      expect(
        isPurelyAlgebraic(
          makeExercise(makeAlgebraicMcq('פתור: אם יש 3 מכוניות ומגיעות עוד 2, כמה יש?')),
        ),
      ).toBe(false)
    })

    it('returns false for English word problem (apples)', () => {
      expect(
        isPurelyAlgebraic(
          makeExercise(makeAlgebraicMcq('John has 5 apples and buys 3 more. How many?')),
        ),
      ).toBe(false)
    })

    it('returns false for mixed Hebrew context (non-whitelisted word)', () => {
      expect(
        isPurelyAlgebraic(
          makeExercise(makeAlgebraicMcq('Calculate the number of chickens on the farm')),
        ),
      ).toBe(false)
    })
  })

  describe('negative cases — no question blocks', () => {
    it('returns false for only rich_text blocks', () => {
      const block: ContentBlock = {
        id: 'rt-1',
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Some text',
        mediaIds: [],
      } as ContentBlock
      expect(isPurelyAlgebraic(makeExercise(block))).toBe(false)
    })
  })

  describe('negative cases — bare numbers without operators', () => {
    it('returns false for bare number without operator', () => {
      expect(isPurelyAlgebraic(makeExercise(makeAlgebraicMcq('5')))).toBe(false)
    })

    it('returns false for number with equals but no operator', () => {
      expect(isPurelyAlgebraic(makeExercise(makeAlgebraicMcq('x = 5')))).toBe(false)
    })
  })

  describe('edge cases — empty/null content', () => {
    it('returns false for exercise with null content', () => {
      expect(isPurelyAlgebraic({ id: 'ex-1', content: null } as never)).toBe(false)
    })

    it('returns false for exercise with undefined content', () => {
      expect(isPurelyAlgebraic({ id: 'ex-1', content: undefined } as never)).toBe(false)
    })
  })
})
