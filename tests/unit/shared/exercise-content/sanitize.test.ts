/**
 * Unit tests for Exercise Content Sanitizer
 *
 * @fileType test
 * @domain ai
 * @pattern sanitization, data-cleaning
 */

import { describe, expect, it } from 'vitest'
import { sanitizeExerciseContentForStudent } from '@/shared/exercise-content/sanitize'
import type { ContentData, InlineRichText } from '@/shared/exercise-content/types'
import type {
  SanitizedTrueFalseBlock,
  SanitizedMcqBlock,
  SanitizedTableBlock,
  SanitizedFreeResponseBlock,
} from '@/shared/exercise-content/sanitize'

// =============================================================================
// TEST HELPERS
// =============================================================================

function createInlineRichText(value: string = 'Test content'): InlineRichText {
  return {
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  }
}

function createMcqOption(
  id: string,
  content: InlineRichText,
): { id: string; content: InlineRichText } {
  return { id, content }
}

function createTrueFalseOption(id: 'true' | 'false', value: boolean, label: InlineRichText) {
  return { id, value, label }
}

// =============================================================================
// TEST CASES
// =============================================================================

describe('sanitizeExerciseContentForStudent', () => {
  describe('strips correctness fields from all block types', () => {
    it('strips correctness fields from true/false question', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'tf-1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: createInlineRichText('Is the sky blue?'),
            options: [
              createTrueFalseOption('true', true, createInlineRichText('True')),
              createTrueFalseOption('false', false, createInlineRichText('False')),
            ],
            answer: { correctOptionId: 'true' },
            hint: createInlineRichText('Hint text'),
            solution: createInlineRichText('Solution text'),
            fullSolution: createInlineRichText('Full solution text'),
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(1)
      const block = result.blocks[0]
      expect(block.id).toBe('tf-1')
      expect(block.type).toBe('question_select')

      // Use type assertion for testing - we know the shape after sanitization
      const tfBlock = block as SanitizedTrueFalseBlock
      expect(tfBlock.variant).toBe('true_false')
      expect(tfBlock.selectionMode).toBe('single')
      expect(tfBlock.prompt.value).toBe('Is the sky blue?')
      expect(tfBlock.options).toHaveLength(2)
      expect(tfBlock.options[0].id).toBe('true')

      // Verify answer-related fields don't exist on sanitized type
      expect('answer' in tfBlock).toBe(false)
      expect('hint' in tfBlock).toBe(false)
      expect('solution' in tfBlock).toBe(false)
      expect('fullSolution' in tfBlock).toBe(false)
    })

    it('strips correctness fields from MCQ question', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'mcq-1',
            type: 'question_select',
            variant: 'mcq',
            selectionMode: 'single',
            prompt: createInlineRichText('What is 2+2?'),
            answer: {
              multiSelect: false,
              options: [
                createMcqOption('a', createInlineRichText('3')),
                createMcqOption('b', createInlineRichText('4')),
                createMcqOption('c', createInlineRichText('5')),
              ],
              correctOptionIds: ['b'],
            },
            hint: createInlineRichText('Think about addition'),
            solution: createInlineRichText('2+2=4'),
            fullSolution: createInlineRichText('2+2 equals 4, which is option B'),
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(1)
      const block = result.blocks[0] as SanitizedMcqBlock
      expect(block.id).toBe('mcq-1')
      expect(block.type).toBe('question_select')
      expect(block.variant).toBe('mcq')
      expect(block.answer.multiSelect).toBe(false)
      expect(block.answer.options).toHaveLength(3)
      expect(block.answer.options[0].content.value).toBe('3')

      // Verify answer-related fields don't exist on sanitized type
      expect('correctOptionIds' in block.answer).toBe(false)
      expect('hint' in block).toBe(false)
      expect('solution' in block).toBe(false)
      expect('fullSolution' in block).toBe(false)
    })

    it('strips correctness fields from free response question', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'fr-1',
            type: 'question_free_response',
            prompt: createInlineRichText('What is the capital of France?'),
            answer: { acceptedAnswers: ['Paris', 'paris', 'PARIS'] },
            hint: createInlineRichText('Think about famous cities'),
            solution: createInlineRichText('Paris'),
            fullSolution: createInlineRichText('The capital of France is Paris'),
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(1)
      const block = result.blocks[0] as SanitizedFreeResponseBlock
      expect(block.id).toBe('fr-1')
      expect(block.type).toBe('question_free_response')
      expect(block.prompt.value).toBe('What is the capital of France?')

      // Verify answer-related fields don't exist on sanitized type
      expect('answer' in block).toBe(false)
      expect('hint' in block).toBe(false)
      expect('solution' in block).toBe(false)
      expect('fullSolution' in block).toBe(false)
    })

    it('strips correctness fields from table question', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'table-1',
            type: 'question_table',
            prompt: createInlineRichText('Fill in the missing values'),
            table: {
              solutionFill: true,
              headers: ['A', 'B', 'C'],
              rowsData: [
                ['1', '2', '3'],
                ['4', '5', '6'],
              ],
              answers: { '0-0': '10', '1-1': '20' },
              showBorders: true,
              showHeader: true,
              columnAlignment: ['left', 'center', 'right'],
            },
            hint: createInlineRichText('Look for patterns'),
            solution: createInlineRichText('The missing values are 10 and 20'),
            fullSolution: createInlineRichText('Row 0 column 0 should be 10, etc.'),
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(1)
      const block = result.blocks[0] as SanitizedTableBlock
      expect(block.id).toBe('table-1')
      expect(block.type).toBe('question_table')
      expect(block.table.headers).toEqual(['A', 'B', 'C'])
      expect(block.table.rowsData).toHaveLength(2)
      expect(block.table.showBorders).toBe(true)
      expect(block.table.showHeader).toBe(true)

      // Verify answer-related fields don't exist on sanitized type
      expect('answers' in block.table).toBe(false)
      expect('solutionFill' in block.table).toBe(false)
      expect('hint' in block).toBe(false)
      expect('solution' in block).toBe(false)
      expect('fullSolution' in block).toBe(false)
    })

    it('handles multi-select MCQ with multiple correct answers', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'mcq-multi-1',
            type: 'question_select',
            variant: 'mcq',
            selectionMode: 'multiple',
            prompt: createInlineRichText('Select all prime numbers'),
            answer: {
              multiSelect: true,
              options: [
                createMcqOption('a', createInlineRichText('1')),
                createMcqOption('b', createInlineRichText('2')),
                createMcqOption('c', createInlineRichText('3')),
                createMcqOption('d', createInlineRichText('4')),
              ],
              correctOptionIds: ['b', 'c'],
            },
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      const block = result.blocks[0] as SanitizedMcqBlock
      expect(block.answer.multiSelect).toBe(true)
      expect('correctOptionIds' in block.answer).toBe(false)
      expect(result.blocks[0].id).toBe('mcq-multi-1')
    })
  })

  describe('preserves non-question blocks unchanged', () => {
    it('preserves rich text block', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'rt-1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: '# Introduction\n\nThis is a **rich text** block.',
            mediaIds: ['media-1', 'media-2'],
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(1)
      expect(result.blocks[0]).toEqual(input.blocks[0])
    })

    it('preserves latex block', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'latex-1',
            type: 'latex',
            latex: 'E = mc^2',
            renderMode: 'block',
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(1)
      expect(result.blocks[0]).toEqual(input.blocks[0])
    })

    it('preserves latex block without renderMode', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'latex-2',
            type: 'latex',
            latex: '\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}',
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(1)
      expect(result.blocks[0].id).toBe('latex-2')
      // Access latex via type assertion
      const latexBlock = result.blocks[0] as { latex: string }
      expect(latexBlock.latex).toBe('\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}')
    })
  })

  describe('handles mixed content', () => {
    it('handles exercise with multiple block types', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'intro-1',
            type: 'rich_text',
            format: 'md-math-v1',
            value: 'Answer the following questions:',
            mediaIds: [],
          },
          {
            id: 'mcq-1',
            type: 'question_select',
            variant: 'mcq',
            selectionMode: 'single',
            prompt: createInlineRichText('What is 1+1?'),
            answer: {
              multiSelect: false,
              options: [
                createMcqOption('a', createInlineRichText('1')),
                createMcqOption('b', createInlineRichText('2')),
              ],
              correctOptionIds: ['b'],
            },
          },
          {
            id: 'latex-1',
            type: 'latex',
            latex: 'x^2',
          },
          {
            id: 'tf-1',
            type: 'question_select',
            variant: 'true_false',
            selectionMode: 'single',
            prompt: createInlineRichText('2+2=4'),
            options: [
              createTrueFalseOption('true', true, createInlineRichText('True')),
              createTrueFalseOption('false', false, createInlineRichText('False')),
            ],
            answer: { correctOptionId: 'true' },
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks).toHaveLength(4)
      expect(result.blocks[0].id).toBe('intro-1')
      expect(result.blocks[0].type).toBe('rich_text')

      const mcqBlock = result.blocks[1] as SanitizedMcqBlock
      expect('correctOptionIds' in mcqBlock.answer).toBe(false)

      expect(result.blocks[2].id).toBe('latex-1')
      expect(result.blocks[2].type).toBe('latex')

      const tfBlock = result.blocks[3] as SanitizedTrueFalseBlock
      expect('answer' in tfBlock).toBe(false)
    })
  })

  describe('does not mutate input', () => {
    it('returns a new object, not the original', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'mcq-1',
            type: 'question_select',
            variant: 'mcq',
            selectionMode: 'single',
            prompt: createInlineRichText('Test?'),
            answer: {
              multiSelect: false,
              options: [createMcqOption('a', createInlineRichText('A'))],
              correctOptionIds: ['a'],
            },
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result).not.toBe(input)
      expect(result.blocks).not.toBe(input.blocks)
      expect(result.blocks[0]).not.toBe(input.blocks[0])
    })

    it('does not modify original answer fields', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'mcq-1',
            type: 'question_select',
            variant: 'mcq',
            selectionMode: 'single',
            prompt: createInlineRichText('Test?'),
            answer: {
              multiSelect: false,
              options: [createMcqOption('a', createInlineRichText('A'))],
              correctOptionIds: ['a'],
            },
          },
        ],
      }

      // Cast to access answer field for testing
      const mcqBlock = input.blocks[0] as { answer: { correctOptionIds: string[] } }
      const originalCorrectIds = [...mcqBlock.answer.correctOptionIds]

      sanitizeExerciseContentForStudent(input)

      expect(mcqBlock.answer.correctOptionIds).toEqual(originalCorrectIds)
    })
  })

  describe('handles edge cases', () => {
    it('handles empty blocks array', () => {
      const input: ContentData = { blocks: [] }
      const result = sanitizeExerciseContentForStudent(input)
      expect(result.blocks).toHaveLength(0)
    })

    it('handles MCQ with single option', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'mcq-single-1',
            type: 'question_select',
            variant: 'mcq',
            selectionMode: 'single',
            prompt: createInlineRichText('Select the only option'),
            answer: {
              multiSelect: false,
              options: [createMcqOption('only', createInlineRichText('The only option'))],
              correctOptionIds: ['only'],
            },
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks[0].id).toBe('mcq-single-1')
      expect((result.blocks[0] as SanitizedMcqBlock).answer.options).toHaveLength(1)
    })

    it('handles table with empty rows', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'table-empty',
            type: 'question_table',
            prompt: createInlineRichText('Fill the table'),
            table: {
              solutionFill: false,
              headers: ['Column 1'],
              rowsData: [],
              answers: {},
              showBorders: true,
              showHeader: true,
            },
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect(result.blocks[0].id).toBe('table-empty')
      expect((result.blocks[0] as SanitizedTableBlock).table.headers).toEqual(['Column 1'])
      expect((result.blocks[0] as SanitizedTableBlock).table.rowsData).toHaveLength(0)
    })

    it('handles table without column alignment', () => {
      const input: ContentData = {
        blocks: [
          {
            id: 'table-no-align',
            type: 'question_table',
            prompt: createInlineRichText('Simple table'),
            table: {
              solutionFill: false,
              headers: ['A', 'B'],
              rowsData: [['1', '2']],
              answers: {},
              showBorders: false,
              showHeader: false,
            },
          },
        ],
      }

      const result = sanitizeExerciseContentForStudent(input)

      expect((result.blocks[0] as SanitizedTableBlock).table.columnAlignment).toBeUndefined()
    })
  })
})
