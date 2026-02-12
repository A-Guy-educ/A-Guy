/**
 * Minimal schema contract tests for Solution Fill Mode
 * Verifies that the backend schema enforces its requirements
 */

import { describe, it, expect } from 'vitest'
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import type { QuestionTableBlock, ContentBlock } from '@/shared/exercise-content/types'

describe('Solution Fill Mode - Schema Contract', () => {
  it('should reject solutionFill=true with missing answers (schema requirement)', () => {
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
          // Missing answer for 1-1 - violates schema
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

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message)
      expect(errors.some((e) => e.includes('Empty cell at 1-1'))).toBe(true)
    }
  })

  it('should accept solutionFill=true when all empty cells have answers', () => {
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
})

