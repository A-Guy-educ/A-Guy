/**
 * V3 Transform Service
 *
 * Transforms LLM extraction output (simple format) to Exercise content blocks (complex format).
 * Provides two outputs:
 * - toPreviewDraft(): preserves editable semantics for admin preview
 * - toExerciseContent(): produces strict ContentSchema payload for persistence
 *
 * @fileType service
 * @domain conversion
 * @pattern transform
 */

import { nanoid } from 'nanoid'
import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import {
  ContentSchema,
  type ExerciseContent,
  QuestionFreeResponseBlockSchema,
  QuestionSelectBlockSchema,
  RichTextBlockSchema,
} from '@/server/payload/collections/Exercises/schemas'

// ---------------------------------
// Input: Simple LLM extraction format
// ---------------------------------

export interface SimpleExtraction {
  question: string
  options: string[] // empty array → free_response
  correctAnswer: number | null // index into options, or null
  explanation?: string
}

// ---------------------------------
// Output A: Preview draft (editable, allows null answer)
// ---------------------------------

export interface PreviewDraft {
  title: string
  question: string
  options: string[]
  correctAnswer: number | null
  explanation?: string
  questionType: 'free_response' | 'true_false' | 'mcq'
}

// ---------------------------------
// Output B: ExerciseContent (validated)
// ---------------------------------

export interface TransformResult {
  title: string // derived from question (first 80 chars)
  content: ExerciseContent
}

// ---------------------------------
// Helper: Create InlineRichText
// ---------------------------------

function createInlineRichText(value: string) {
  return {
    type: 'rich_text' as const,
    format: 'md-math-v1' as const,
    value,
    mediaIds: [],
  }
}

// ---------------------------------
// Helper: Create rich_text block
// ---------------------------------

function createRichTextBlock(value: string): ContentBlock {
  return RichTextBlockSchema.parse({
    id: nanoid(),
    type: 'rich_text',
    format: 'md-math-v1',
    value,
    mediaIds: [],
  })
}

// ---------------------------------
// toPreviewDraft: preserves editable semantics
// ---------------------------------

/**
 * Transform simple extraction to preview draft format.
 * Preserves null correctAnswer for admin editing.
 */
export function toPreviewDraft(extraction: SimpleExtraction): PreviewDraft {
  const { question, options, correctAnswer, explanation } = extraction

  // Determine question type
  let questionType: PreviewDraft['questionType']
  if (options.length === 0) {
    questionType = 'free_response'
  } else if (options.length === 2 && isTrueFalsePattern(options)) {
    questionType = 'true_false'
  } else {
    questionType = 'mcq'
  }

  // Derive title from question (first 80 chars)
  const title = question.length > 80 ? question.substring(0, 77) + '...' : question

  return {
    title,
    question,
    options,
    correctAnswer,
    explanation,
    questionType,
  }
}

// ---------------------------------
// toExerciseContent: produces strict ContentSchema
// ---------------------------------

/**
 * Transform simple extraction to ExerciseContent for persistence.
 * Uses deterministic fallback for null correctAnswer (first option).
 * Throws if content is invalid.
 */
export function toExerciseContent(extraction: SimpleExtraction): TransformResult {
  const { question, options, correctAnswer, explanation } = extraction

  const blocks: ContentBlock[] = []

  // Determine question type and build appropriate block
  if (options.length === 0) {
    // Free response question
    const block = QuestionFreeResponseBlockSchema.parse({
      id: nanoid(),
      type: 'question_free_response',
      prompt: createInlineRichText(question),
      answer: {
        acceptedAnswers: ['(answer not detected)'],
      },
    })
    blocks.push(block)
  } else if (options.length === 2 && isTrueFalsePattern(options)) {
    // True/False question
    const trueOptionId = 'true'
    const falseOptionId = 'false'

    // Map correctAnswer to option ID
    let correctOptionId: string | undefined
    if (correctAnswer !== null) {
      correctOptionId = correctAnswer === 0 ? trueOptionId : falseOptionId
    }

    const block = QuestionSelectBlockSchema.parse({
      id: nanoid(),
      type: 'question_select',
      variant: 'true_false',
      selectionMode: 'single',
      prompt: createInlineRichText(question),
      options: [
        { id: trueOptionId, value: true, label: createInlineRichText('True') },
        { id: falseOptionId, value: false, label: createInlineRichText('False') },
      ],
      answer: {
        correctOptionId,
      },
    })
    blocks.push(block)
  } else {
    // MCQ question
    const optionIds = options.map(() => nanoid())

    // Map correctAnswer to option IDs (deterministic fallback if null)
    let correctOptionIds: string[]
    if (correctAnswer !== null && correctAnswer < options.length) {
      correctOptionIds = [optionIds[correctAnswer]]
    } else {
      // Fallback to first option for schema validity
      correctOptionIds = [optionIds[0]]
    }

    const block = QuestionSelectBlockSchema.parse({
      id: nanoid(),
      type: 'question_select',
      variant: 'mcq',
      selectionMode: 'single',
      prompt: createInlineRichText(question),
      answer: {
        multiSelect: false,
        options: options.map((opt, idx) => ({
          id: optionIds[idx],
          content: createInlineRichText(opt),
        })),
        correctOptionIds,
      },
    })
    blocks.push(block)
  }

  // Add explanation as rich_text block if present
  if (explanation && explanation.trim()) {
    blocks.push(createRichTextBlock(explanation))
  }

  // Derive title from question (first 80 chars)
  const title = question.length > 80 ? question.substring(0, 77) + '...' : question

  // Validate against ContentSchema
  const content: ExerciseContent = { blocks }
  const result = ContentSchema.safeParse(content)
  if (!result.success) {
    throw new Error(`Invalid exercise content: ${result.error.message}`)
  }

  return { title, content }
}

// ---------------------------------
// Helper: Check if options match true/false pattern
// ---------------------------------

function isTrueFalsePattern(options: string[]): boolean {
  if (options.length !== 2) return false

  const normalized = options.map((opt) => opt.toLowerCase().trim())

  return normalized.includes('true') && normalized.includes('false')
}

// ---------------------------------
// Additional export: Rebuild from edited preview
// ---------------------------------

/**
 * Rebuild exercise content from edited preview data.
 * Used when admin edits the preview before creating the exercise.
 */
export function rebuildFromPreview(edited: Omit<PreviewDraft, 'questionType'>): TransformResult {
  const extraction: SimpleExtraction = {
    question: edited.question,
    options: edited.options,
    correctAnswer: edited.correctAnswer,
    explanation: edited.explanation,
  }

  return toExerciseContent(extraction)
}
