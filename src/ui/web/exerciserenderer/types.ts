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
  | { type: 'table'; cellValues: Record<string, string> }

export interface TableCellResult {
  key: string
  isCorrect: boolean
}

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
export interface TrueFalseOption {
  id: 'true' | 'false'
  value: boolean
  label: InlineRichText
}

export interface TrueFalseAnswer {
  correctOptionId?: string
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
  acceptedAnswers: string[]
}

/**
 * Table block data - used inside QuestionTableBlock
 */
export interface TableBlock {
  solutionFill: boolean
  headers: string[]
  rowsData: string[][]
  answers: Record<string, string> | undefined
  showBorders: boolean
  showHeader: boolean
  columnAlignment?: ('left' | 'center' | 'right')[]
}

/**
 * Question block types
 */
// True/False variant
export interface QuestionSelectTrueFalseBlock {
  id: string
  type: 'question_select'
  variant: 'true_false'
  selectionMode: 'single'
  prompt: InlineRichText
  options?: [
    { id: 'true'; value: true; label: InlineRichText },
    { id: 'false'; value: false; label: InlineRichText },
  ]
  answer: TrueFalseAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

// MCQ variant
export interface QuestionSelectMcqBlock {
  id: string
  type: 'question_select'
  variant: 'mcq'
  selectionMode: 'single' | 'multiple'
  prompt: InlineRichText
  answer: McqAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

export type QuestionSelectBlock = QuestionSelectTrueFalseBlock | QuestionSelectMcqBlock

export interface QuestionFreeResponseBlock {
  id: string
  type: 'question_free_response'
  prompt: InlineRichText
  answer: FreeResponseAnswer
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

export interface QuestionTableBlock {
  id: string
  type: 'question_table'
  prompt: InlineRichText
  table: TableBlock
  hint?: InlineRichText
  solution?: InlineRichText
  fullSolution?: InlineRichText
}

export type QuestionBlock = QuestionSelectBlock | QuestionFreeResponseBlock | QuestionTableBlock

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
  /** Pre-resolved media objects keyed by ID, for rendering mediaIds in blocks */
  mediaMap?: Record<string, import('@/payload-types').Media>
  /** Exercise number to display in the bubble (defaults to 1) */
  exerciseNumber?: number
}
