/**
 * Test for Solution Fill Mode validation
 * Verifies that incomplete Solution Fill Mode blocks are properly validated
 */

import { describe, it, expect } from 'vitest'
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import type { QuestionTableBlock, ContentBlock } from '@/shared/exercise-content/types'

describe('Solution Fill Mode - Schema Validation Requirements', () => {
  it('should REJECT when solutionFill is true but answers is empty', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Complete the table:',
        mediaIds: [],
      },
      table: {
        solutionFill: true,
        headers: ['Column 1', 'Column 2'],
        rowsData: [
          ['', 'B'], // Empty at 0-0
          ['C', ''], // Empty at 1-1
        ],
        answers: {}, // Empty - violates schema
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left'],
      },
      hint: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      solution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      fullSolution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
    }

    const content = { blocks: [block as ContentBlock] }
    const result = ContentSchema.safeParse(content)

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message)
      expect(errors).toContain('When solutionFill is true, answers must have at least one entry')
    }
  })

  it('should REJECT when solutionFill is true and not ALL empty cells have answers', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Complete the table:',
        mediaIds: [],
      },
      table: {
        solutionFill: true,
        headers: ['Column 1', 'Column 2', 'Column 3'],
        rowsData: [
          ['A', '', 'C'], // Empty at 0-1
          ['', 'E', 'F'], // Empty at 1-0
          ['G', 'H', ''], // Empty at 2-2
        ],
        answers: {
          '0-1': 'Answer for 0-1',
          '1-0': 'Answer for 1-0',
          // Missing answer for 2-2 - violates schema requirement
        },
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'center', 'right'],
      },
      hint: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      solution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      fullSolution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
    }

    const content = { blocks: [block as ContentBlock] }
    const result = ContentSchema.safeParse(content)

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message)
      expect(errors.some((e) => e.includes('Empty cell at 2-2'))).toBe(true)
    }
  })

  it('should ACCEPT when solutionFill is true and ALL empty cells have answers', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Complete the table:',
        mediaIds: [],
      },
      table: {
        solutionFill: true,
        headers: ['Column 1', 'Column 2'],
        rowsData: [
          ['', 'B'], // Empty at 0-0
          ['C', ''], // Empty at 1-1
        ],
        answers: {
          '0-0': 'Answer for 0-0',
          '1-1': 'Answer for 1-1',
          // All empty cells have answers
        },
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left'],
      },
      hint: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      solution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      fullSolution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
    }

    const content = { blocks: [block as ContentBlock] }
    const result = ContentSchema.safeParse(content)

    expect(result.success).toBe(true)
  })

  it('should ACCEPT when solutionFill is false (no validation needed)', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: 'Complete the table:',
        mediaIds: [],
      },
      table: {
        solutionFill: false, // Disabled
        headers: ['Column 1', 'Column 2'],
        rowsData: [
          ['', 'B'], // Empty cells exist
          ['C', ''],
        ],
        answers: {}, // Empty answers OK when solutionFill is false
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left'],
      },
      hint: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      solution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
      fullSolution: {
        type: 'rich_text',
        format: 'md-math-v1',
        value: '',
        mediaIds: [],
      },
    }

    const content = { blocks: [block as ContentBlock] }
    const result = ContentSchema.safeParse(content)

    expect(result.success).toBe(true)
  })
})
