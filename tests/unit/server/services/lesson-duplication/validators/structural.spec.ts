/**
 * Unit tests for src/server/services/lesson-duplication/validators/structural.ts
 *
 * Target: 100% line coverage on the structural validator module.
 * Pattern: pure function tests — no mocks, no I/O.
 */
import { describe, expect, it } from 'vitest'
import {
  validateExerciseStructural,
  FAILURE_CODES,
} from '@/server/services/lesson-duplication/validators/structural'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'

function makeRichText(id: string, value: string): ContentBlock {
  return {
    id,
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  } as ContentBlock
}

function makeMcq(
  id: string,
  options: Array<{ id: string; content: { value: string } }>,
  correctOptionIds: string[],
  hasHint = false,
  hasSolution = false,
  hasFullSolution = false,
): ContentBlock {
  return {
    id,
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    prompt: { type: 'rich_text', format: 'md-math-v1', value: 'What is 2+2?', mediaIds: [] },
    answer: {
      multiSelect: false,
      options: options.map((o) => ({
        id: o.id,
        content: {
          type: 'rich_text',
          format: 'md-math-v1',
          value: o.content.value,
          mediaIds: [] as string[],
        },
      })),
      correctOptionIds,
    },
    hint: hasHint
      ? { type: 'rich_text', format: 'md-math-v1', value: 'Hint', mediaIds: [] }
      : undefined,
    solution: hasSolution
      ? { type: 'rich_text', format: 'md-math-v1', value: 'Solution', mediaIds: [] }
      : undefined,
    fullSolution: hasFullSolution
      ? { type: 'rich_text', format: 'md-math-v1', value: 'Full solution', mediaIds: [] }
      : undefined,
  } as ContentBlock
}

function makeSvg(id: string, value: string): ContentBlock {
  return {
    id,
    type: 'svg',
    value,
    altText: undefined,
  } as ContentBlock
}

function makeHtml(id: string, html: string): ContentBlock {
  return {
    id,
    type: 'html',
    html,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ContentBlock
}

describe('validateExerciseStructural', () => {
  describe('TOO_MANY_SECTIONS', () => {
    it('passes for 5 blocks', () => {
      const blocks: ContentBlock[] = Array.from({ length: 5 }, (_, i) =>
        makeRichText(`block-${i}`, 'content'),
      )
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails for 6 blocks', () => {
      const blocks: ContentBlock[] = Array.from({ length: 6 }, (_, i) =>
        makeRichText(`block-${i}`, 'content'),
      )
      const failures = validateExerciseStructural(blocks)
      expect(failures).toHaveLength(1)
      expect(failures[0].code).toBe(FAILURE_CODES.TOO_MANY_SECTIONS)
    })

    it('fails for 10 blocks with correct code', () => {
      const blocks: ContentBlock[] = Array.from({ length: 10 }, (_, i) =>
        makeRichText(`block-${i}`, 'content'),
      )
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.TOO_MANY_SECTIONS)).toBe(true)
    })
  })

  describe('PNG_FORBIDDEN', () => {
    it('passes for text without PNG', () => {
      const blocks: ContentBlock[] = [makeRichText('block-1', 'This is plain text')]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails for data:image/png;base64 data URI', () => {
      const blocks: ContentBlock[] = [
        makeRichText('block-1', 'Some text with data:image/png;base64,iVBOR...'),
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.PNG_FORBIDDEN)).toBe(true)
    })

    it('fails for .png file reference', () => {
      const blocks: ContentBlock[] = [makeRichText('block-1', 'Image at ./image.png in content')]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.PNG_FORBIDDEN)).toBe(true)
    })

    it('fails for PNG in SVG block value', () => {
      const blocks: ContentBlock[] = [makeSvg('svg-1', 'data:image/png;base64,xyz')]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.PNG_FORBIDDEN)).toBe(true)
    })

    it('passes for empty SVG value', () => {
      const blocks: ContentBlock[] = [makeSvg('svg-1', '')]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails for PNG in HTML block html field', () => {
      const blocks: ContentBlock[] = [makeHtml('html-1', '<img src="data:image/png;base64,xyz">')]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.PNG_FORBIDDEN)).toBe(true)
    })

    it('passes for HTML without PNG', () => {
      const blocks: ContentBlock[] = [makeHtml('html-1', '<p>Hello world</p>')]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })
  })

  describe('INVALID_SVG', () => {
    it('passes for empty SVG value', () => {
      const blocks: ContentBlock[] = [makeSvg('svg-1', '')]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('passes for SVG starting with <svg', () => {
      const blocks: ContentBlock[] = [
        makeSvg('svg-1', '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'),
      ]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('passes for whitespace-only SVG value', () => {
      const blocks: ContentBlock[] = [makeSvg('svg-1', '   ')]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails for SVG value that starts with text', () => {
      const blocks: ContentBlock[] = [makeSvg('svg-1', 'This is not an SVG')]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.INVALID_SVG)).toBe(true)
    })

    it('fails for SVG value that starts with <div>', () => {
      const blocks: ContentBlock[] = [makeSvg('svg-1', '<div>not svg</div>')]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.INVALID_SVG)).toBe(true)
    })
  })

  describe('MISSING_HINT', () => {
    it('passes when MCQ has hint', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          true, // hasHint
          true, // hasSolution (also required)
          true, // hasFullSolution (also required)
        ),
      ]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails when MCQ is missing hint', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          false, // hasHint = false → missing
          true,
          true,
        ),
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_HINT)).toBe(true)
    })
  })

  describe('MISSING_SOLUTION', () => {
    it('passes when MCQ has solution', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          true,
          true, // hasSolution
          true, // hasFullSolution (also required)
        ),
      ]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails when MCQ is missing solution', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          true,
          false, // hasSolution = false → missing
          true,
        ),
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_SOLUTION)).toBe(true)
    })
  })

  describe('MISSING_FULL_SOLUTION', () => {
    it('passes when MCQ has fullSolution', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          true,
          true,
          true,
        ),
      ]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails when MCQ is missing fullSolution', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          true,
          true,
          false,
        ),
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_FULL_SOLUTION)).toBe(true)
    })
  })

  describe('MISSING_WRONG_OPTIONS', () => {
    it('passes when MCQ has at least 2 options', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          true, // hasHint
          true, // hasSolution
          true, // hasFullSolution
        ),
      ]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails when MCQ has only 1 option', () => {
      const blocks: ContentBlock[] = [
        makeMcq('mcq-1', [{ id: 'a', content: { value: 'A' } }], ['a'], true, true, true),
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_WRONG_OPTIONS)).toBe(true)
    })

    it('fails when MCQ has 0 options', () => {
      const blocks: ContentBlock[] = [makeMcq('mcq-1', [], ['a'], true, true, true)]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_WRONG_OPTIONS)).toBe(true)
    })
  })

  describe('MISSING_CORRECT_OPTION', () => {
    it('passes when MCQ has correctOptionIds', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          ['a'],
          true, // hasHint
          true, // hasSolution
          true, // hasFullSolution
        ),
      ]
      expect(validateExerciseStructural(blocks)).toHaveLength(0)
    })

    it('fails when MCQ has empty correctOptionIds', () => {
      const blocks: ContentBlock[] = [
        makeMcq(
          'mcq-1',
          [
            { id: 'a', content: { value: 'A' } },
            { id: 'b', content: { value: 'B' } },
          ],
          [],
          true, // hasHint
          true, // hasSolution
          true, // hasFullSolution
        ),
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_CORRECT_OPTION)).toBe(true)
    })
  })

  describe('multiple failures', () => {
    it('returns all failures across different codes', () => {
      // MCQ with no hint, no solution, no fullSolution, only 1 option, no correctOptionIds
      const blocks: ContentBlock[] = [
        makeMcq('mcq-1', [{ id: 'a', content: { value: 'A' } }], [], false, false, false),
      ]
      const failures = validateExerciseStructural(blocks)
      const codes = failures.map((f) => f.code)
      expect(codes).toContain(FAILURE_CODES.MISSING_HINT)
      expect(codes).toContain(FAILURE_CODES.MISSING_SOLUTION)
      expect(codes).toContain(FAILURE_CODES.MISSING_FULL_SOLUTION)
      expect(codes).toContain(FAILURE_CODES.MISSING_WRONG_OPTIONS)
      expect(codes).toContain(FAILURE_CODES.MISSING_CORRECT_OPTION)
    })
  })

  describe('non-MCQ blocks', () => {
    it('question_free_response has hint/solution/fullSolution checks', () => {
      const blocks: ContentBlock[] = [
        {
          id: 'fr-1',
          type: 'question_free_response',
          prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Explain', mediaIds: [] },
          answer: { acceptedAnswers: ['Because'] },
          hint: undefined,
          solution: undefined,
          fullSolution: undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any as ContentBlock,
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_HINT)).toBe(true)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_SOLUTION)).toBe(true)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_FULL_SOLUTION)).toBe(true)
    })

    it('question_table has hint/solution/fullSolution checks', () => {
      const blocks: ContentBlock[] = [
        {
          id: 'table-1',
          type: 'question_table',
          prompt: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Fill the table',
            mediaIds: [],
          },
          table: {
            headers: ['A', 'B'],
            rowsData: [['1', '2']],
            solutionFill: false,
            showBorders: true,
            showHeader: true,
          },
          hint: undefined,
          solution: undefined,
          fullSolution: undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any as ContentBlock,
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_HINT)).toBe(true)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_SOLUTION)).toBe(true)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_FULL_SOLUTION)).toBe(true)
    })

    it('question_matching has hint/solution/fullSolution checks', () => {
      const blocks: ContentBlock[] = [
        {
          id: 'match-1',
          type: 'question_matching',
          prompt: {
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Match the pairs',
            mediaIds: [],
          },
          leftColumn: [
            {
              id: 'l1',
              content: { type: 'rich_text', format: 'md-math-v1', value: 'A', mediaIds: [] },
            },
          ],
          rightColumn: [
            {
              id: 'r1',
              content: { type: 'rich_text', format: 'md-math-v1', value: 'a', mediaIds: [] },
            },
          ],
          correctPairs: [{ optionId: 'l1', matchId: 'r1' }],
          hint: undefined,
          solution: undefined,
          fullSolution: undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any as ContentBlock,
      ]
      const failures = validateExerciseStructural(blocks)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_HINT)).toBe(true)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_SOLUTION)).toBe(true)
      expect(failures.some((f) => f.code === FAILURE_CODES.MISSING_FULL_SOLUTION)).toBe(true)
    })
  })
})
