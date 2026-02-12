/**
 * Unit tests for ExerciseContentEditor validation helpers
 */

import { describe, it, expect } from 'vitest'
import { validateSolutionFillTables } from '@/ui/admin/ExerciseContentEditor/validation'
import type { QuestionTableBlock, ContentBlock } from '@/shared/exercise-content/types'

describe('validateSolutionFillTables', () => {
  it('should return null when solutionFill is false', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Test', mediaIds: [] },
      table: {
        solutionFill: false,
        headers: ['Col 1', 'Col 2'],
        rowsData: [
          ['', 'B'],
          ['C', ''],
        ],
        answers: {}, // No answers, but solutionFill is false
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left'],
      },
      hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }

    const result = validateSolutionFillTables({ blocks: [block as ContentBlock] })
    expect(result).toBeNull()
  })

  it('should return null when solutionFill is true and all empty cells have answers', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Test', mediaIds: [] },
      table: {
        solutionFill: true,
        headers: ['Col 1', 'Col 2'],
        rowsData: [
          ['', 'B'],
          ['C', ''],
        ],
        answers: {
          '0-0': 'Answer for 0-0',
          '1-1': 'Answer for 1-1',
        },
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left'],
      },
      hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }

    const result = validateSolutionFillTables({ blocks: [block as ContentBlock] })
    expect(result).toBeNull()
  })

  it('should return error message when solutionFill is true and missing answers', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Test', mediaIds: [] },
      table: {
        solutionFill: true,
        headers: ['Col 1', 'Col 2'],
        rowsData: [
          ['', 'B'],
          ['C', ''],
        ],
        answers: {
          '0-0': 'Answer for 0-0',
          // Missing answer for 1-1
        },
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left'],
      },
      hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }

    const result = validateSolutionFillTables({ blocks: [block as ContentBlock] })

    expect(result).not.toBeNull()
    expect(result).toContain('1 empty cell missing answers')
    expect(result).toContain('Row 2, Col 2')
    expect(result).toContain('Solution Fill Mode requires all empty cells to have answers')
  })

  it('should auto-disable solutionFill when table has no empty cells (normalization)', () => {
    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Test', mediaIds: [] },
      table: {
        solutionFill: true,
        headers: ['Col 1', 'Col 2'],
        rowsData: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        answers: {}, // No empty cells, so no answers needed/allowed
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left'],
      },
      hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }

    const result = validateSolutionFillTables({ blocks: [block as ContentBlock] })

    // Should not return error - normalization happens automatically
    expect(result).toBeNull()
    // Verify that solutionFill was auto-disabled
    expect(block.table.solutionFill).toBe(false)
  })

  it('should limit preview to first 10 cells and show count', () => {
    // Create a table with 15 empty cells
    const rowsData = Array(5)
      .fill(null)
      .map(() => ['', '', ''])

    const block: QuestionTableBlock = {
      id: 'block-1',
      type: 'question_table',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Test', mediaIds: [] },
      table: {
        solutionFill: true,
        headers: ['Col 1', 'Col 2', 'Col 3'],
        rowsData,
        answers: {}, // No answers for 15 empty cells
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left', 'left', 'left'],
      },
      hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }

    const result = validateSolutionFillTables({ blocks: [block as ContentBlock] })

    expect(result).not.toBeNull()
    expect(result).toContain('15 empty cells missing answers')
    expect(result).toContain('and 5 more')
    // Verify it shows Row 1 through Row 4 (10 cells total)
    expect(result).toContain('Row 1, Col 1')
    expect(result).toContain('Row 3, Col 3')
  })

  it('should handle multiple blocks and validate each', () => {
    const validBlock: QuestionTableBlock = {
      id: 'valid',
      type: 'question_table',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Test', mediaIds: [] },
      table: {
        solutionFill: true,
        headers: ['Col 1'],
        rowsData: [['']],
        answers: { '0-0': 'Answer' },
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left'],
      },
      hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }

    const invalidBlock: QuestionTableBlock = {
      id: 'invalid',
      type: 'question_table',
      prompt: { type: 'rich_text', format: 'md-math-v1', value: 'Test', mediaIds: [] },
      table: {
        solutionFill: true,
        headers: ['Col 1'],
        rowsData: [['']],
        answers: {}, // Missing answer
        showBorders: true,
        showHeader: true,
        columnAlignment: ['left'],
      },
      hint: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      solution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
      fullSolution: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }

    const result = validateSolutionFillTables({
      blocks: [validBlock as ContentBlock, invalidBlock as ContentBlock],
    })

    // Should fail because one block is invalid
    expect(result).not.toBeNull()
  })
})
