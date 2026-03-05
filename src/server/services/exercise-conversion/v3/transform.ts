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

import type { ContentBlock } from '@/server/payload/collections/Exercises/schemas'
import {
  ContentSchema,
  type ExerciseContent,
  QuestionFreeResponseBlockSchema,
  QuestionSelectBlockSchema,
  RichTextBlockSchema,
} from '@/server/payload/collections/Exercises/schemas'
import { nanoid } from 'nanoid'

// ---------------------------------
// Multi-Part Exercise Types (NEW)
// ---------------------------------

export interface SubQuestionExtraction {
  prompt: string
  type?: 'free_response' | 'mcq' | 'true_false'
  options?: string[]
  correctAnswer?: number | null
  acceptedAnswers?: string[]
  diagramDescription?: string // NEW: diagram specific to this sub-question
}

export interface MultiPartExtraction {
  stem?: string
  subQuestions: SubQuestionExtraction[]
  diagramDescription?: string
  diagramPosition?: 'before_question' | 'after_question'
}

export interface SubQuestionDraft {
  prompt: string
  type: 'free_response' | 'mcq' | 'true_false'
  options: string[]
  correctAnswer: number | null
  acceptedAnswer?: string
  diagramDescription?: string // NEW: diagram specific to this sub-question
}

export interface MultiPartPreviewDraft {
  title: string
  stem?: string
  subQuestions: SubQuestionDraft[]
  diagramDescription?: string
  diagramPosition?: string
}

// ---------------------------------
// Input: Simple LLM extraction format
// ---------------------------------

export interface SimpleExtraction {
  question: string
  options: string[] // empty array → free_response
  correctAnswer: number | null // index into options, or null
  explanation?: string
  acceptedAnswer?: string // for free_response questions
  diagramDescription?: string // markdown+LaTeX description of diagram
  diagramPosition?: 'before_question' | 'after_question' // position of diagram block
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
  diagramDescription?: string // NEW: markdown+LaTeX description of diagram
  diagramPosition?: string // NEW: position of diagram block
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
  const { question, options, correctAnswer, explanation, diagramDescription, diagramPosition } =
    extraction

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
    diagramDescription,
    diagramPosition,
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
  const {
    question,
    options,
    correctAnswer,
    explanation,
    acceptedAnswer,
    diagramDescription,
    diagramPosition,
  } = extraction

  const blocks: ContentBlock[] = []

  // Build diagram block if present (will be inserted based on position after question block is added)
  let diagramBlock: ContentBlock | null = null
  if (diagramDescription?.trim()) {
    diagramBlock = createRichTextBlock(diagramDescription)
    const position = diagramPosition ?? 'before_question'
    if (position === 'before_question') {
      // Will be added before question block
    } else {
      // Will be added after question block - mark for later insertion
      diagramBlock = diagramBlock
    }
  }

  // Determine question type and build appropriate block
  if (options.length === 0) {
    // Free response question
    const acceptedAnswers = acceptedAnswer?.trim()
      ? [acceptedAnswer.trim()]
      : ['(answer not detected)']

    const block = QuestionFreeResponseBlockSchema.parse({
      id: nanoid(),
      type: 'question_free_response',
      prompt: createInlineRichText(question),
      answer: {
        acceptedAnswers,
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

  // Insert diagram block based on position
  const position = diagramPosition ?? 'before_question'
  if (diagramBlock && position === 'before_question') {
    // Insert at start (before question)
    blocks.unshift(diagramBlock)
  } else if (diagramBlock && position === 'after_question') {
    // Insert after question (at index 1)
    blocks.splice(1, 0, diagramBlock)
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
export function rebuildFromPreview(
  edited: Omit<PreviewDraft, 'questionType'> & { acceptedAnswer?: string },
): TransformResult {
  const extraction: SimpleExtraction = {
    question: edited.question,
    options: edited.options,
    correctAnswer: edited.correctAnswer,
    explanation: edited.explanation,
    acceptedAnswer: edited.acceptedAnswer,
    diagramDescription: edited.diagramDescription || undefined,
    diagramPosition: (edited.diagramPosition as 'before_question' | 'after_question') || undefined,
  }

  return toExerciseContent(extraction)
}

// ---------------------------------
// Multi-Part Exercise Transform Functions (NEW)
// ---------------------------------

/**
 * Transform multi-part extraction to preview draft format.
 * Derives title from stem or first sub-question prompt.
 */
export function multiPartToPreviewDraft(extraction: MultiPartExtraction): MultiPartPreviewDraft {
  const { stem, subQuestions, diagramDescription, diagramPosition } = extraction

  // Derive title from stem or first sub-question
  let title: string
  if (stem?.trim()) {
    title = stem.length > 80 ? stem.substring(0, 77) + '...' : stem
  } else if (subQuestions.length > 0 && subQuestions[0]?.prompt?.trim()) {
    const firstPrompt = subQuestions[0].prompt
    title = firstPrompt.length > 80 ? firstPrompt.substring(0, 77) + '...' : firstPrompt
  } else {
    title = 'Untitled Exercise'
  }

  // Map each sub-question to SubQuestionDraft
  const mappedSubQuestions: SubQuestionDraft[] = subQuestions.map((sq) => {
    let type: SubQuestionDraft['type'] = 'free_response'

    if (sq.type === 'mcq' || sq.type === 'true_false') {
      type = sq.type
    } else if (sq.options && sq.options.length > 0) {
      // If options exist but type wasn't specified, determine based on options
      if (sq.options.length === 2 && isTrueFalsePattern(sq.options)) {
        type = 'true_false'
      } else {
        type = 'mcq'
      }
    }

    return {
      prompt: sq.prompt || '',
      type,
      options: sq.options || [],
      correctAnswer: sq.correctAnswer ?? null,
      acceptedAnswer: sq.acceptedAnswers?.[0] || '',
      diagramDescription: sq.diagramDescription, // NEW: pass through per-sub-question diagram
    }
  })

  return {
    title,
    stem,
    subQuestions: mappedSubQuestions,
    diagramDescription,
    diagramPosition,
  }
}

/**
 * Create a single question block from a sub-question extraction.
 * Reuses existing MCQ/true-false/free-response logic.
 */
function createQuestionBlock(sq: SubQuestionExtraction): ContentBlock {
  const { prompt, type, options, correctAnswer, acceptedAnswers } = sq

  // Determine effective type based on options
  let effectiveType: 'free_response' | 'mcq' | 'true_false' = type || 'free_response'

  if (effectiveType === 'free_response' && options && options.length > 0) {
    if (options.length === 2 && isTrueFalsePattern(options)) {
      effectiveType = 'true_false'
    } else {
      effectiveType = 'mcq'
    }
  }

  if (effectiveType === 'free_response') {
    // Free response question
    const accepted = acceptedAnswers?.filter(Boolean) || []
    const acceptedAnswersList = accepted.length > 0 ? accepted : ['(answer not detected)']

    return QuestionFreeResponseBlockSchema.parse({
      id: nanoid(),
      type: 'question_free_response',
      prompt: createInlineRichText(prompt),
      answer: {
        acceptedAnswers: acceptedAnswersList,
      },
    })
  }

  if (effectiveType === 'true_false') {
    // True/False question
    const trueOptionId = 'true'
    const falseOptionId = 'false'

    let correctOptionId: string | undefined
    if (correctAnswer !== null && correctAnswer !== undefined) {
      correctOptionId = correctAnswer === 0 ? trueOptionId : falseOptionId
    }

    return QuestionSelectBlockSchema.parse({
      id: nanoid(),
      type: 'question_select',
      variant: 'true_false',
      selectionMode: 'single',
      prompt: createInlineRichText(prompt),
      options: [
        { id: trueOptionId, value: true, label: createInlineRichText('True') },
        { id: falseOptionId, value: false, label: createInlineRichText('False') },
      ],
      answer: {
        correctOptionId,
      },
    })
  }

  // MCQ question
  const optionIds = (options || []).map(() => nanoid())

  let correctOptionIds: string[]
  if (
    correctAnswer !== null &&
    correctAnswer !== undefined &&
    correctAnswer < (options || []).length
  ) {
    correctOptionIds = [optionIds[correctAnswer]]
  } else {
    // Fallback to first option for schema validity
    correctOptionIds = [optionIds[0]]
  }

  return QuestionSelectBlockSchema.parse({
    id: nanoid(),
    type: 'question_select',
    variant: 'mcq',
    selectionMode: 'single',
    prompt: createInlineRichText(prompt),
    answer: {
      multiSelect: false,
      options: (options || []).map((opt, idx) => ({
        id: optionIds[idx],
        content: createInlineRichText(opt),
      })),
      correctOptionIds,
    },
  })
}

/**
 * Transform multi-part extraction to exercise content.
 * Builds blocks array in order: diagram?, stem?, diagram?, question1, question2, ...
 */
export function multiPartToExerciseContent(extraction: MultiPartExtraction): TransformResult {
  const { stem, subQuestions, diagramDescription, diagramPosition } = extraction
  const blocks: ContentBlock[] = []

  const effectivePosition = diagramPosition ?? 'before_question'

  // Create diagram block if present
  let diagramBlock: ContentBlock | null = null
  if (diagramDescription?.trim()) {
    diagramBlock = createRichTextBlock(diagramDescription)
  }

  // Insert diagram at position based on effectivePosition
  // For multi-part, we insert diagram at the very beginning (before everything)
  // unless it's after_question and there are sub-questions
  if (diagramBlock) {
    if (effectivePosition === 'before_question' || !subQuestions.length) {
      blocks.push(diagramBlock)
    }
  }

  // Add stem rich_text block if present
  if (stem?.trim()) {
    blocks.push(createRichTextBlock(stem))
  }

  // Insert diagram after stem if position is after_question
  if (diagramBlock && effectivePosition === 'after_question' && subQuestions.length > 0) {
    blocks.push(diagramBlock)
  }

  // Add each sub-question, preceded by its diagram if it has one
  for (const sq of subQuestions) {
    if (sq.prompt?.trim()) {
      // Insert per-sub-question diagram BEFORE the question block
      if (sq.diagramDescription?.trim()) {
        blocks.push(createRichTextBlock(sq.diagramDescription))
      }
      blocks.push(createQuestionBlock(sq))
    }
  }

  // Derive title from stem or first sub-question
  let title: string
  if (stem?.trim()) {
    title = stem.length > 80 ? stem.substring(0, 77) + '...' : stem
  } else if (subQuestions.length > 0 && subQuestions[0]?.prompt?.trim()) {
    const firstPrompt = subQuestions[0].prompt
    title = firstPrompt.length > 80 ? firstPrompt.substring(0, 77) + '...' : firstPrompt
  } else {
    title = 'Untitled Exercise'
  }

  // Validate against ContentSchema
  const content: ExerciseContent = { blocks }
  const result = ContentSchema.safeParse(content)
  if (!result.success) {
    throw new Error(`Invalid exercise content: ${result.error.message}`)
  }

  return { title, content }
}

/**
 * Rebuild exercise content from edited multi-part preview.
 * Used when admin edits the multi-part preview before creating the exercise.
 */
export function rebuildFromMultiPartPreview(edited: MultiPartPreviewDraft): TransformResult {
  // Convert preview draft back to extraction format
  const extraction: MultiPartExtraction = {
    stem: edited.stem,
    subQuestions: edited.subQuestions.map((sq) => ({
      prompt: sq.prompt,
      type: sq.type,
      options: sq.options,
      correctAnswer: sq.correctAnswer,
      acceptedAnswers: sq.acceptedAnswer ? [sq.acceptedAnswer] : undefined,
      diagramDescription: sq.diagramDescription, // NEW: pass through per-sub-question diagram
    })),
    diagramDescription: edited.diagramDescription,
    diagramPosition: (edited.diagramPosition as 'before_question' | 'after_question') || undefined,
  }

  return multiPartToExerciseContent(extraction)
}

// ---------------------------------
// Auto-Detect Diagram Misclassification
// ---------------------------------

/**
 * Auto-detect diagram misclassification.
 * If a global diagram exists but only ONE sub-question references diagrams/graphs/figures,
 * move the global diagram to that sub-question's diagramDescription.
 *
 * Returns a new (immutable) extraction — does not mutate the input.
 */
export function autoAssignDiagrams(extraction: MultiPartExtraction): MultiPartExtraction {
  const { diagramDescription, subQuestions } = extraction

  // Guard against missing subQuestions
  if (!subQuestions || !Array.isArray(subQuestions)) return extraction

  // Only act if there IS a global diagram and NO sub-questions already have diagrams
  if (!diagramDescription?.trim()) return extraction
  const anySubHasDiagram = subQuestions.some((sq) => sq.diagramDescription?.trim())
  if (anySubHasDiagram) return extraction

  // Keywords that indicate a sub-question references a diagram
  const DIAGRAM_KEYWORDS = [
    /\bgraph\b/i,
    /\bdiagram\b/i,
    /\bfigure\b/i,
    /\bdrawing\b/i,
    /\bsketch\b/i,
    /\bchart\b/i,
    /\bplot\b/i,
    // Hebrew equivalents
    /\bגרף\b/,
    /\bתרשים\b/,
    /\bציור\b/,
    /\bשרטוט\b/,
    /\bסקיצה\b/,
    // Common phrases
    /based on the/i,
    /according to the/i,
    /shown in the/i,
    /see the/i,
    /לפי ה/,
    /על פי ה/,
    /בהתבוננות ב/,
  ]

  // Find sub-questions that reference diagrams
  const referencingIndices: number[] = []
  for (let i = 0; i < subQuestions.length; i++) {
    const prompt = subQuestions[i].prompt || ''
    if (DIAGRAM_KEYWORDS.some((kw) => kw.test(prompt))) {
      referencingIndices.push(i)
    }
  }

  // Only auto-move if exactly ONE sub-question references the diagram
  if (referencingIndices.length !== 1) return extraction

  const targetIdx = referencingIndices[0]

  // Create new extraction with diagram moved to the target sub-question
  return {
    ...extraction,
    diagramDescription: undefined,
    diagramPosition: undefined,
    subQuestions: subQuestions.map((sq, idx) =>
      idx === targetIdx ? { ...sq, diagramDescription: diagramDescription } : sq,
    ),
  }
}
