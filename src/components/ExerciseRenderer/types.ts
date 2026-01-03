/**
 * Type definitions for Exercise Renderer
 *
 * Strict: Only supports content.blocks format
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
 * Content structure - STRICT
 * ONLY valid: { blocks: RichTextBlock[] }
 */
export interface ExerciseContentData {
  blocks: Array<{
    id: string
    type: 'rich_text'
    format: 'md-math-v1'
    value: string
  }>
}

export interface ExerciseRendererProps {
  content: ExerciseContentData
  answerSpec: import('@/contracts').AnswerSpec
  questionType: 'mcq' | 'true_false' | 'free_response'
  mode?: PreviewMode
  showCheckAnswer?: boolean
  onAnswerChange?: (answer: UserAnswer) => void
  initialAnswer?: UserAnswer
  className?: string
}
