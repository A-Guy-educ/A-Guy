/**
 * Unit tests for V3 Transform Service
 *
 * Tests src/server/services/exercise-conversion/v3/transform.ts
 * Pure functions - no DB needed.
 *
 * Test coverage:
 * - toPreviewDraft() - MCQ, True/False, Free response transformations
 * - toExerciseContent() - produces valid ContentSchema blocks
 * - rebuildFromPreview() - roundtrip from preview to content
 * - Title truncation rules
 *
 * Run: pnpm exec vitest run tests/unit/services/v3-transform.test.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import {
  multiPartToExerciseContent,
  multiPartToPreviewDraft,
  rebuildFromPreview,
  toExerciseContent,
  toPreviewDraft,
  type PreviewDraft,
  type SimpleExtraction,
} from '@/server/services/exercise-conversion/v3/transform'
import { describe, expect, it } from 'vitest'

describe('V3 Transform Service', () => {
  // ============================================
  // toPreviewDraft() tests
  // ============================================

  describe('toPreviewDraft', () => {
    it('should extract MCQ with 3+ options → questionType: mcq', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
        explanation: 'Basic addition',
      }

      const result = toPreviewDraft(extraction)

      expect(result.questionType).toBe('mcq')
      expect(result.options).toEqual(['3', '4', '5', '6'])
      expect(result.correctAnswer).toBe(1)
      expect(result.explanation).toBe('Basic addition')
    })

    it('should truncate title at 80 chars (77 + ...)', () => {
      const longQuestion = 'A'.repeat(100)
      const extraction: SimpleExtraction = {
        question: longQuestion,
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)

      expect(result.title).toBe('A'.repeat(77) + '...')
      expect(result.title.length).toBe(80)
    })

    it('should preserve short question verbatim in title', () => {
      const shortQuestion = 'What is 2+2?'
      const extraction: SimpleExtraction = {
        question: shortQuestion,
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = toPreviewDraft(extraction)

      expect(result.title).toBe('What is 2+2?')
    })

    it('should extract True/False (["True", "False"]) → questionType: true_false', () => {
      const extraction: SimpleExtraction = {
        question: 'The sky is blue.',
        options: ['True', 'False'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)

      expect(result.questionType).toBe('true_false')
      expect(result.options).toEqual(['True', 'False'])
    })

    it('should extract True/False case-insensitive (["true", "false"]) → questionType: true_false', () => {
      const extraction: SimpleExtraction = {
        question: 'The earth is flat.',
        options: ['true', 'false'],
        correctAnswer: 1,
      }

      const result = toPreviewDraft(extraction)

      expect(result.questionType).toBe('true_false')
    })

    it('should extract Free response (empty options) → questionType: free_response', () => {
      const extraction: SimpleExtraction = {
        question: 'Explain the water cycle.',
        options: [],
        correctAnswer: null,
      }

      const result = toPreviewDraft(extraction)

      expect(result.questionType).toBe('free_response')
      expect(result.options).toEqual([])
    })

    it('should preserve null correctAnswer in preview', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: null,
      }

      const result = toPreviewDraft(extraction)

      expect(result.correctAnswer).toBeNull()
    })

    it('should handle MCQ with 2 non-true/false options as mcq', () => {
      const extraction: SimpleExtraction = {
        question: 'Pick A or B',
        options: ['A', 'B'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)

      expect(result.questionType).toBe('mcq')
    })

    it('should handle Yes/No as mcq (not true_false)', () => {
      const extraction: SimpleExtraction = {
        question: 'Do you agree?',
        options: ['Yes', 'No'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)

      expect(result.questionType).toBe('mcq')
    })

    it('should handle 3 options as mcq (not true_false)', () => {
      const extraction: SimpleExtraction = {
        question: 'Pick one of three',
        options: ['True', 'False', 'Maybe'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)

      expect(result.questionType).toBe('mcq')
    })

    it('toPreviewDraft with undefined diagramDescription has no diagramDescription property', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = toPreviewDraft(extraction)

      expect(result.diagramDescription).toBeUndefined()
    })
  })

  // ============================================
  // toExerciseContent() tests
  // ============================================

  describe('toExerciseContent', () => {
    it('should produce question_select block for MCQ with variant: mcq', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
        explanation: 'Basic addition',
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(2) // question + explanation
      const questionBlock = result.content.blocks[0] as any
      expect(questionBlock.type).toBe('question_select')
      expect(questionBlock.variant).toBe('mcq')
      expect(questionBlock.answer.correctOptionIds).toBeDefined()
    })

    it('should map correctAnswer index to option ID for MCQ', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 2, // index 2 = '5'
      }

      const result = toExerciseContent(extraction)

      const questionBlock = result.content.blocks[0] as any
      const correctOptionId = questionBlock.answer.correctOptionIds[0]
      const option5 = questionBlock.answer.options.find((o: any) => o.id === correctOptionId)
      expect(option5.content.value).toBe('5')
    })

    it('should fallback to first option when correctAnswer is null for MCQ', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: null,
      }

      const result = toExerciseContent(extraction)

      const questionBlock = result.content.blocks[0] as any
      const correctOptionId = questionBlock.answer.correctOptionIds[0]
      const firstOption = questionBlock.answer.options.find((o: any) => o.id === correctOptionId)
      expect(firstOption.content.value).toBe('3')
    })

    it('should produce question_select block for True/False with variant: true_false', () => {
      const extraction: SimpleExtraction = {
        question: 'The sky is blue.',
        options: ['True', 'False'],
        correctAnswer: 0,
      }

      const result = toExerciseContent(extraction)

      const questionBlock = result.content.blocks[0] as any
      expect(questionBlock.type).toBe('question_select')
      expect(questionBlock.variant).toBe('true_false')
      // True/False uses fixed option IDs
      const options = questionBlock.options
      expect(options.find((o: any) => o.id === 'true').label.value).toBe('True')
      expect(options.find((o: any) => o.id === 'false').label.value).toBe('False')
    })

    it('should map correctAnswer to true/false option IDs', () => {
      const extraction: SimpleExtraction = {
        question: 'The sky is blue.',
        options: ['True', 'False'],
        correctAnswer: 1, // False
      }

      const result = toExerciseContent(extraction)

      const questionBlock = result.content.blocks[0] as any
      // True/False uses correctOptionId (singular), not correctOptionIds (plural)
      expect(questionBlock.answer.correctOptionId).toBe('false')
    })

    it('should produce question_free_response block for free response', () => {
      const extraction: SimpleExtraction = {
        question: 'Explain the water cycle.',
        options: [],
        correctAnswer: null,
        acceptedAnswer: 'Evaporation and condensation',
      }

      const result = toExerciseContent(extraction)

      const questionBlock = result.content.blocks[0] as any
      expect(questionBlock.type).toBe('question_free_response')
      expect(questionBlock.answer.acceptedAnswers).toEqual(['Evaporation and condensation'])
    })

    it('should fallback to "(answer not detected)" when acceptedAnswer is missing', () => {
      const extraction: SimpleExtraction = {
        question: 'Explain the water cycle.',
        options: [],
        correctAnswer: null,
      }

      const result = toExerciseContent(extraction)

      const questionBlock = result.content.blocks[0] as any
      expect(questionBlock.answer.acceptedAnswers).toEqual(['(answer not detected)'])
    })

    it('should append rich_text block after question when explanation present', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
        explanation: 'Basic addition: 2+2=4',
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(2)
      const explanationBlock = result.content.blocks[1]
      expect(explanationBlock.type).toBe('rich_text')
      expect((explanationBlock as any).value).toBe('Basic addition: 2+2=4')
    })

    it('should produce only 1 block when no explanation', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(1)
    })

    it('should validate output against ContentSchema', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
        explanation: 'Basic addition',
      }

      const result = toExerciseContent(extraction)

      const validation = ContentSchema.safeParse(result.content)
      expect(validation.success).toBe(true)
    })

    it('should gracefully handle invalid extraction (0 options but correctAnswer set)', () => {
      // This case creates content as free_response - correctAnswer is ignored for free_response
      const extraction: SimpleExtraction = {
        question: 'Test question',
        options: [], // empty = free_response
        correctAnswer: 2, // ignored for free_response
      }

      // Implementation handles gracefully - treats as free_response
      const result = toExerciseContent(extraction)
      expect(result.content.blocks).toHaveLength(1)
      const questionBlock = result.content.blocks[0] as any
      expect(questionBlock.type).toBe('question_free_response')
      // Falls back to "(answer not detected)" when no acceptedAnswer
      expect(questionBlock.answer.acceptedAnswers).toEqual(['(answer not detected)'])
    })

    it('should derive title from question (first 80 chars)', () => {
      const shortQuestion = 'What is 2+2?'
      const extraction: SimpleExtraction = {
        question: shortQuestion,
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = toExerciseContent(extraction)

      expect(result.title).toBe('What is 2+2?')
    })

    it('should truncate long question title', () => {
      const longQuestion = 'A'.repeat(100)
      const extraction: SimpleExtraction = {
        question: longQuestion,
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = toExerciseContent(extraction)

      expect(result.title).toBe('A'.repeat(77) + '...')
    })

    it('produces same block count with undefined diagramDescription', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = toExerciseContent(extraction)

      // Only question block, no diagram block added
      expect(result.content.blocks).toHaveLength(1)
      expect((result.content.blocks[0] as any).type).toBe('question_select')
    })
  })

  // ============================================
  // rebuildFromPreview() tests
  // ============================================

  describe('rebuildFromPreview', () => {
    it('should produce valid content from edited preview (MCQ roundtrip)', () => {
      const preview: Omit<PreviewDraft, 'questionType'> = {
        title: 'What is 2+2?',
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
        explanation: 'Basic addition',
      }

      const result = rebuildFromPreview(preview)

      expect(result.content.blocks).toHaveLength(2)
      expect(result.title).toBe('What is 2+2?')

      // Validate against ContentSchema
      const validation = ContentSchema.safeParse(result.content)
      expect(validation.success).toBe(true)
    })

    it('should rebuild MCQ with edited options/correctAnswer', () => {
      const preview: Omit<PreviewDraft, 'questionType'> = {
        title: 'What is 3+3?',
        question: 'What is 3+3?',
        options: ['5', '6', '7', '8'],
        correctAnswer: 2, // now points to '7'
      }

      const result = rebuildFromPreview(preview)

      const questionBlock = result.content.blocks[0] as any
      const correctOptionId = questionBlock.answer.correctOptionIds[0]
      const correctOption = questionBlock.answer.options.find((o: any) => o.id === correctOptionId)
      expect(correctOption.content.value).toBe('7')
    })

    it('should rebuild free response with custom acceptedAnswer', () => {
      const preview: Omit<PreviewDraft, 'questionType'> & { acceptedAnswer?: string } = {
        title: 'Explain photosynthesis',
        question: 'Explain photosynthesis',
        options: [],
        correctAnswer: null,
        acceptedAnswer: 'Light energy converted to chemical energy',
      }

      const result = rebuildFromPreview(preview)

      const questionBlock = result.content.blocks[0] as any
      expect(questionBlock.type).toBe('question_free_response')
      expect(questionBlock.answer.acceptedAnswers).toContain(
        'Light energy converted to chemical energy',
      )
    })

    it('should handle null correctAnswer in rebuild (fallback to first option)', () => {
      const preview: Omit<PreviewDraft, 'questionType'> = {
        title: 'What is 2+2?',
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: null,
      }

      const result = rebuildFromPreview(preview)

      const questionBlock = result.content.blocks[0] as any
      const correctOptionId = questionBlock.answer.correctOptionIds[0]
      const firstOption = questionBlock.answer.options.find((o: any) => o.id === correctOptionId)
      expect(firstOption.content.value).toBe('3') // fallback to first
    })

    it('should derive title matching question truncation rules', () => {
      const shortQuestion = 'What is 2+2?'
      const preview: Omit<PreviewDraft, 'questionType'> = {
        title: shortQuestion, // ignored in rebuild
        question: shortQuestion,
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = rebuildFromPreview(preview)

      expect(result.title).toBe(shortQuestion)
    })
  })

  // ============================================
  // isTrueFalsePattern() - tested indirectly via toPreviewDraft
  // ============================================

  describe('isTrueFalsePattern (via toPreviewDraft)', () => {
    it('should detect ["true", "false"] → true_false', () => {
      const extraction: SimpleExtraction = {
        question: 'Test',
        options: ['true', 'false'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)
      expect(result.questionType).toBe('true_false')
    })

    it('should detect ["True", "False"] case-insensitive → true_false', () => {
      const extraction: SimpleExtraction = {
        question: 'Test',
        options: ['True', 'False'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)
      expect(result.questionType).toBe('true_false')
    })

    it('should detect ["TRUE", "FALSE"] uppercase → true_false', () => {
      const extraction: SimpleExtraction = {
        question: 'Test',
        options: ['TRUE', 'FALSE'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)
      expect(result.questionType).toBe('true_false')
    })

    it('should treat ["Yes", "No"] as mcq (not true_false)', () => {
      const extraction: SimpleExtraction = {
        question: 'Test',
        options: ['Yes', 'No'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)
      expect(result.questionType).toBe('mcq')
    })

    it('should treat ["True", "False", "Maybe"] as mcq (3 options)', () => {
      const extraction: SimpleExtraction = {
        question: 'Test',
        options: ['True', 'False', 'Maybe'],
        correctAnswer: 0,
      }

      const result = toPreviewDraft(extraction)
      expect(result.questionType).toBe('mcq')
    })
  })

  // ============================================
  // Multi-Part Title Derivation tests
  // ============================================

  describe('Multi-Part Title Derivation', () => {
    it('should use LLM-generated title when provided', () => {
      const extraction = {
        title: 'שטח משולש ישר זווית',
        stem: 'Given: triangle ABC where AB = 5, BC = 12',
        subQuestions: [
          { prompt: 'Find the area of triangle ABC', type: 'free_response' as const },
          { prompt: 'Find angle B', type: 'free_response' as const },
        ],
      }

      const previewResult = multiPartToPreviewDraft(extraction)
      const contentResult = multiPartToExerciseContent(extraction)

      expect(previewResult.title).toBe('שטח משולש ישר זווית')
      expect(contentResult.title).toBe('שטח משולש ישר זווית')
    })

    it('should fall back to stem when title missing', () => {
      const extraction = {
        stem: 'Given: triangle ABC where AB = 5, BC = 12',
        subQuestions: [{ prompt: 'Find the area of triangle ABC', type: 'free_response' as const }],
      }

      const previewResult = multiPartToPreviewDraft(extraction)
      const contentResult = multiPartToExerciseContent(extraction)

      expect(previewResult.title).toBe('Given: triangle ABC where AB = 5, BC = 12')
      expect(contentResult.title).toBe('Given: triangle ABC where AB = 5, BC = 12')
    })

    it('should fall back to first prompt when both title and stem missing', () => {
      const extraction = {
        stem: undefined,
        subQuestions: [
          { prompt: 'Find the area of triangle ABC', type: 'free_response' as const },
          { prompt: 'Find angle B', type: 'free_response' as const },
        ],
      }

      const previewResult = multiPartToPreviewDraft(extraction)
      const contentResult = multiPartToExerciseContent(extraction)

      expect(previewResult.title).toBe('Find the area of triangle ABC')
      expect(contentResult.title).toBe('Find the area of triangle ABC')
    })

    it('should truncate LLM title at 80 chars', () => {
      const longTitle = 'A'.repeat(100)
      const extraction = {
        title: longTitle,
        subQuestions: [{ prompt: 'Test question', type: 'free_response' as const }],
      }

      const previewResult = multiPartToPreviewDraft(extraction)

      expect(previewResult.title).toBe('A'.repeat(77) + '...')
      expect(previewResult.title.length).toBe(80)
    })

    it('should skip whitespace-only title and fall back', () => {
      const extraction = {
        title: '   ', // whitespace-only
        stem: 'Given: triangle ABC',
        subQuestions: [{ prompt: 'Find the area', type: 'free_response' as const }],
      }

      const previewResult = multiPartToPreviewDraft(extraction)

      // Should fall back to stem since whitespace-only title is ignored
      expect(previewResult.title).toBe('Given: triangle ABC')
    })

    it('should be consistent title between preview and content functions', () => {
      const extraction = {
        title: 'Quadratic Equations',
        stem: 'Solve the following quadratic equations',
        subQuestions: [{ prompt: 'Solve x² + 5x + 6 = 0', type: 'free_response' as const }],
      }

      const previewResult = multiPartToPreviewDraft(extraction)
      const contentResult = multiPartToExerciseContent(extraction)

      expect(previewResult.title).toBe(contentResult.title)
    })

    it('should return "Untitled Exercise" when no title, stem, or prompts', () => {
      const extraction = {
        stem: undefined,
        subQuestions: [],
      }

      const previewResult = multiPartToPreviewDraft(extraction)

      expect(previewResult.title).toBe('Untitled Exercise')
    })
  })
})
