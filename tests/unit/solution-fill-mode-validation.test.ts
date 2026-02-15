/**
 * Minimal schema contract tests for Solution Fill Mode
 * Verifies that the backend schema enforces its requirements
 */

import { describe, it, expect } from 'vitest'
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import { normalizeTableCellWhitespace } from '@/server/payload/collections/Exercises/hooks'
import type { QuestionTableBlock, ContentBlock } from '@/shared/exercise-content/types'

// Test fixture builder
const createTableBlock = (
  rowsData: string[][],
  solutionFill: boolean,
  answers: Record<string, string> = {},
): QuestionTableBlock => ({
  id: 'block-1',
  type: 'question_table',
  prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Complete the table:', mediaIds: [] },
  table: {
    solutionFill,
    headers: rowsData[0].map((_, i) => `Column ${i + 1}`),
    rowsData,
    answers,
    showBorders: true,
    showHeader: true,
    columnAlignment: rowsData[0].map(() => 'left' as const),
  },
  hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
  solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
  fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
})

describe('Solution Fill Mode - Schema Contract', () => {
  it('should reject solutionFill=true with missing answers (schema requirement)', () => {
    const block = createTableBlock(
      [['', 'B'], ['C', '']],
      true,
      { '0-0': 'Answer for 0-0' }, // Missing answer for 1-1
    )
    const result = ContentSchema.safeParse({ blocks: [block as ContentBlock] })

    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message)
      expect(errors.some((e) => e.includes('Empty cell at 1-1'))).toBe(true)
    }
  })

  it('should accept solutionFill=true when all empty cells have answers', () => {
    const block = createTableBlock(
      [['', 'B'], ['C', '']],
      true,
      { '0-0': 'Answer for 0-0', '1-1': 'Answer for 1-1' },
    )
    const result = ContentSchema.safeParse({ blocks: [block as ContentBlock] })
    expect(result.success).toBe(true)
  })
})

describe('Whitespace Normalization - Hook Unit Test', () => {
  it('should normalize table cell whitespace: trim non-empty, convert whitespace-only to empty', async () => {
    const block = createTableBlock([[' abc ', '   ']], false)
    const data = { content: { blocks: [block as ContentBlock] } }

    const normalized = await normalizeTableCellWhitespace({ data, operation: 'create', req: {} as any })

    const normalizedBlock = normalized.content.blocks[0] as QuestionTableBlock
    expect(normalizedBlock.table.rowsData[0][0]).toBe('abc') // Trimmed
    expect(normalizedBlock.table.rowsData[0][1]).toBe('') // Whitespace-only → empty
  })
})

describe('Whitespace Normalization - E2E Validation', () => {
  it('should fail validation when whitespace-only cell lacks answer (solutionFill=true)', async () => {
    const block = createTableBlock([['   ']], true, {}) // Whitespace cell, no answer
    const data = { content: { blocks: [block as ContentBlock] } }

    const normalized = await normalizeTableCellWhitespace({ data, operation: 'create', req: {} as any })
    const normalizedBlock = normalized.content.blocks[0] as QuestionTableBlock
    expect(normalizedBlock.table.rowsData[0][0]).toBe('') // Normalized to empty

    const result = ContentSchema.safeParse(normalized.content)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Empty cell at 0-0'))).toBe(true)
    }
  })

  it('should pass validation when whitespace-only cell has answer (solutionFill=true)', async () => {
    const block = createTableBlock([['   ']], true, { '0-0': 'Answer' }) // Whitespace cell with answer
    const data = { content: { blocks: [block as ContentBlock] } }

    const normalized = await normalizeTableCellWhitespace({ data, operation: 'create', req: {} as any })
    const normalizedBlock = normalized.content.blocks[0] as QuestionTableBlock
    expect(normalizedBlock.table.rowsData[0][0]).toBe('') // Normalized to empty

    const result = ContentSchema.safeParse(normalized.content)
    expect(result.success).toBe(true)
  })

  it('should trim non-empty cells and pass validation', async () => {
    const block = createTableBlock([['  hello  ', '  world  ']], false)
    const data = { content: { blocks: [block as ContentBlock] } }

    const normalized = await normalizeTableCellWhitespace({ data, operation: 'create', req: {} as any })
    const normalizedBlock = normalized.content.blocks[0] as QuestionTableBlock
    expect(normalizedBlock.table.rowsData[0]).toEqual(['hello', 'world'])

    const result = ContentSchema.safeParse(normalized.content)
    expect(result.success).toBe(true)
  })
})
