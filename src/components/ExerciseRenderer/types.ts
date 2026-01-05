/**
 * Type definitions for Exercise Renderer
 *
 * Supports block-based structure with multiple question blocks
 */

export type PreviewMode = 'student' | 'debug'

export type UserAnswer =
  | { type: 'mcq'; selectedIds: string[] }
  | { type: 'true_false'; value: boolean | null }
  | { type: 'free_response'; value: string }

export interface CheckResult {
  isCorrect: boolean
  message?: string
}

/**
 * Inline rich text (no id) - used within question blocks
 */
export interface InlineRichText {
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds?: string[]
}

/**
 * Stream rich text block (has id)
 */
export interface RichTextBlock {
  id: string
  type: 'rich_text'
  format: 'md-math-v1'
  value: string
  mediaIds?: string[]
}

/**
 * Answer types for different question blocks
 */
export interface TrueFalseAnswer {
  correct: boolean
}

export interface McqOption {
  id: string
  content: InlineRichText
}

export interface McqAnswer {
  multiSelect: boolean
  options: McqOption[]
  correctOptionIds: string[]
}

export interface FreeResponseAnswer {
  responseKind: 'numeric' | 'text'
  acceptedAnswers: string[]
  tolerance: number
}

/**
 * Question block types
 */
export interface QuestionTrueFalseBlock {
  id: string
  type: 'question_true_false'
  prompt: InlineRichText
  answer: TrueFalseAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

export interface QuestionMcqBlock {
  id: string
  type: 'question_mcq'
  prompt: InlineRichText
  answer: McqAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

export interface QuestionFreeResponseBlock {
  id: string
  type: 'question_free_response'
  prompt: InlineRichText
  answer: FreeResponseAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

export type QuestionBlock = QuestionTrueFalseBlock | QuestionMcqBlock | QuestionFreeResponseBlock

export type ContentBlock = RichTextBlock | QuestionBlock

/**
 * Content structure - block-based with questions
 */
export interface ExerciseContentData {
  blocks: ContentBlock[]
}

/**
 * Props for the new block-based exercise renderer
 */
export interface ExerciseRendererProps {
  content: ExerciseContentData
  mode?: PreviewMode
  showCheckAnswer?: boolean
  className?: string
}
