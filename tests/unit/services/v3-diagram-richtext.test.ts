/**
 * Unit tests for V3 Diagram Rich Text Extraction
 *
 * Tests src/server/services/exercise-conversion/v3/transform.ts
 * Diagram extraction and rich text block creation.
 *
 * Test coverage:
 * - toPreviewDraft() - carries diagramDescription and diagramPosition through to preview
 * - toExerciseContent() - creates rich_text block from diagramDescription
 * - rebuildFromPreview() - round-trips diagramDescription through rebuild
 *
 * Run: pnpm exec vitest run tests/unit/services/v3-diagram-richtext.test.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContentSchema } from '@/server/payload/collections/Exercises/schemas'
import {
  rebuildFromPreview,
  toExerciseContent,
  toPreviewDraft,
  type PreviewDraft,
  type SimpleExtraction,
} from '@/server/services/exercise-conversion/v3/transform'
import { describe, expect, it } from 'vitest'

describe('V3 Diagram Rich Text Extraction', () => {
  // ============================================
  // toPreviewDraft() tests - diagram fields
  // ============================================

  describe('toPreviewDraft', () => {
    it('should carry diagramDescription through to preview', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area of a triangle?',
        options: ['10', '20', '30', '40'],
        correctAnswer: 1,
        diagramDescription: '**Diagram:** Right triangle with base 4cm and height 5cm',
        diagramPosition: 'before_question',
      }

      const result = toPreviewDraft(extraction)

      expect(result.diagramDescription).toBe(
        '**Diagram:** Right triangle with base 4cm and height 5cm',
      )
      expect(result.diagramPosition).toBe('before_question')
    })

    it('should carry diagramPosition through to preview', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area?',
        options: ['10', '20'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** A circle with radius 3',
        diagramPosition: 'after_question',
      }

      const result = toPreviewDraft(extraction)

      expect(result.diagramPosition).toBe('after_question')
    })

    it('should omit diagram fields when not present', () => {
      const extraction: SimpleExtraction = {
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: 1,
      }

      const result = toPreviewDraft(extraction)

      expect(result.diagramDescription).toBeUndefined()
      expect(result.diagramPosition).toBeUndefined()
    })
  })

  // ============================================
  // toExerciseContent() tests - diagram rich_text block
  // ============================================

  describe('toExerciseContent', () => {
    it('should create a rich_text block from diagramDescription', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area?',
        options: ['10', '20', '30', '40'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** Right triangle ABC',
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(2) // question + diagram
      const diagramBlock = result.content.blocks[0] as any
      expect(diagramBlock.type).toBe('rich_text')
      expect(diagramBlock.value).toBe('**Diagram:** Right triangle ABC')
    })

    it('rich_text block value starts with "**Diagram:**"', () => {
      const extraction: SimpleExtraction = {
        question: 'Find x',
        options: ['1', '2'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** Right triangle $ABC$ where $AB = 5$',
      }

      const result = toExerciseContent(extraction)

      const diagramBlock = result.content.blocks[0] as any
      expect(diagramBlock.value.startsWith('**Diagram:**')).toBe(true)
    })

    it('inserts diagram block BEFORE question when position is before_question', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area?',
        options: ['10', '20'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** Triangle',
        diagramPosition: 'before_question',
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(2)
      const firstBlock = result.content.blocks[0] as any
      const secondBlock = result.content.blocks[1] as any
      expect(firstBlock.type).toBe('rich_text')
      expect(firstBlock.value).toBe('**Diagram:** Triangle')
      expect(secondBlock.type).toBe('question_select')
    })

    it('inserts diagram block AFTER question when position is after_question', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area?',
        options: ['10', '20'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** Triangle',
        diagramPosition: 'after_question',
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(2)
      const firstBlock = result.content.blocks[0] as any
      const secondBlock = result.content.blocks[1] as any
      expect(firstBlock.type).toBe('question_select')
      expect(secondBlock.type).toBe('rich_text')
      expect(secondBlock.value).toBe('**Diagram:** Triangle')
    })

    it('defaults to before_question when position is missing', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area?',
        options: ['10', '20'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** Triangle',
        // diagramPosition undefined
      }

      const result = toExerciseContent(extraction)

      const firstBlock = result.content.blocks[0] as any
      expect(firstBlock.type).toBe('rich_text')
      expect(firstBlock.value).toBe('**Diagram:** Triangle')
    })

    it('skips diagram block when diagramDescription is empty string', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area?',
        options: ['10', '20'],
        correctAnswer: 0,
        diagramDescription: '',
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(1) // only question
    })

    it('skips diagram block when diagramDescription is undefined', () => {
      const extraction: SimpleExtraction = {
        question: 'What is the area?',
        options: ['10', '20'],
        correctAnswer: 0,
        // diagramDescription undefined
      }

      const result = toExerciseContent(extraction)

      expect(result.content.blocks).toHaveLength(1) // only question
    })

    it('validates final content against ContentSchema', () => {
      const extraction: SimpleExtraction = {
        question: 'Find the area',
        options: ['10', '20', '30', '40'],
        correctAnswer: 1,
        diagramDescription: '**Diagram:** Rectangle 4x5',
        explanation: 'Use formula A = b*h',
      }

      const result = toExerciseContent(extraction)

      // 3 blocks: diagram + question + explanation
      expect(result.content.blocks).toHaveLength(3)
      const validation = ContentSchema.safeParse(result.content)
      expect(validation.success).toBe(true)
    })

    it('text-only extraction (no diagram) produces identical output to current behavior', () => {
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
      const explanationBlock = result.content.blocks[1] as any
      expect(explanationBlock.type).toBe('rich_text')
    })
  })

  // ============================================
  // rebuildFromPreview() tests - diagram roundtrip
  // ============================================

  describe('rebuildFromPreview', () => {
    it('round-trips diagramDescription through rebuild', () => {
      const preview: Omit<PreviewDraft, 'questionType'> = {
        title: 'Find the area',
        question: 'Find the area of the triangle',
        options: ['10', '20', '30', '40'],
        correctAnswer: 1,
        diagramDescription: '**Diagram:** Right triangle with legs 3 and 4',
        diagramPosition: 'before_question',
      }

      const result = rebuildFromPreview(preview)

      expect(result.content.blocks).toHaveLength(2)
      const diagramBlock = result.content.blocks[0] as any
      expect(diagramBlock.type).toBe('rich_text')
      expect(diagramBlock.value).toBe('**Diagram:** Right triangle with legs 3 and 4')
    })

    it('round-trips diagramPosition through rebuild', () => {
      const preview: Omit<PreviewDraft, 'questionType'> = {
        title: 'Find the area',
        question: 'Find the area of the triangle',
        options: ['10', '20'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** Triangle',
        diagramPosition: 'after_question',
      }

      const result = rebuildFromPreview(preview)

      const firstBlock = result.content.blocks[0] as any
      const secondBlock = result.content.blocks[1] as any
      expect(firstBlock.type).toBe('question_select')
      expect(secondBlock.type).toBe('rich_text')
    })

    it('works without diagram fields (backward compat)', () => {
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

    it('handles rebuild with after_question position correctly', () => {
      const preview: Omit<PreviewDraft, 'questionType'> = {
        title: 'Question',
        question: 'Question text',
        options: ['A', 'B'],
        correctAnswer: 0,
        diagramDescription: '**Diagram:** A geometric figure',
        diagramPosition: 'after_question',
      }

      const result = rebuildFromPreview(preview)

      const firstBlock = result.content.blocks[0] as any
      const secondBlock = result.content.blocks[1] as any
      expect(firstBlock.type).toBe('question_select')
      expect(secondBlock.type).toBe('rich_text')
      expect(secondBlock.value).toBe('**Diagram:** A geometric figure')
    })
  })
})
