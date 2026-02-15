/**
 * Minimal schema contract tests for Solution Fill Mode
 * Verifies that the backend schema enforces its requirements
 */

import { describe, it, expect } from 'vitest'
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import { normalizeTableCellWhitespace } from '@/server/payload/collections/Exercises/hooks'
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

describe('Whitespace Normalization', () => {
  it('should treat whitespace-only cells as empty and require answers when solutionFill=true', async () => {
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
        headers: ['Column 1'],
        rowsData: [
          ['   '], // Whitespace-only cell at 0-0
        ],
        answers: {}, // Missing answer for 0-0
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left'],
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

    const data = { content: { blocks: [block as ContentBlock] } }

    // Normalize data (simulating hook execution)
    const normalized = await normalizeTableCellWhitespace({
      data,
      operation: 'create',
      req: {} as any,
    })

    // Verify normalization converted whitespace to empty string
    const normalizedBlock = normalized.content.blocks[0] as QuestionTableBlock
    expect(normalizedBlock.table.rowsData[0][0]).toBe('')

    // Verify schema validation fails (missing answer for empty cell)
    const result = ContentSchema.safeParse(normalized.content)
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message)
      expect(errors.some((e) => e.includes('Empty cell at 0-0'))).toBe(true)
    }
  })

  it('should accept whitespace-only cells with provided answers when solutionFill=true', async () => {
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
        headers: ['Column 1'],
        rowsData: [
          ['   '], // Whitespace-only cell at 0-0
        ],
        answers: {
          '0-0': 'Answer for 0-0', // Answer provided
        },
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left'],
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

    const data = { content: { blocks: [block as ContentBlock] } }

    // Normalize data (simulating hook execution)
    const normalized = await normalizeTableCellWhitespace({
      data,
      operation: 'create',
      req: {} as any,
    })

    // Verify normalization converted whitespace to empty string
    const normalizedBlock = normalized.content.blocks[0] as QuestionTableBlock
    expect(normalizedBlock.table.rowsData[0][0]).toBe('')

    // Verify schema validation passes (answer provided for empty cell)
    const result = ContentSchema.safeParse(normalized.content)
    expect(result.success).toBe(true)
  })

  it('should trim leading/trailing whitespace from non-empty cells', async () => {
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
        solutionFill: false,
        headers: ['Column 1', 'Column 2'],
        rowsData: [
          ['  hello  ', '  world  '], // Cells with leading/trailing whitespace
          [' abc ', ' xyz '],
        ],
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

    const data = { content: { blocks: [block as ContentBlock] } }

    // Normalize data (simulating hook execution)
    const normalized = await normalizeTableCellWhitespace({
      data,
      operation: 'create',
      req: {} as any,
    })

    // Verify trimming
    const normalizedBlock = normalized.content.blocks[0] as QuestionTableBlock
    expect(normalizedBlock.table.rowsData[0][0]).toBe('hello')
    expect(normalizedBlock.table.rowsData[0][1]).toBe('world')
    expect(normalizedBlock.table.rowsData[1][0]).toBe('abc')
    expect(normalizedBlock.table.rowsData[1][1]).toBe('xyz')

    // Verify schema validation passes
    const result = ContentSchema.safeParse(normalized.content)
    expect(result.success).toBe(true)
  })
})
