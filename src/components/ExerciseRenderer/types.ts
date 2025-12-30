/**
 * Type definitions for Exercise Renderer
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

export interface ExerciseRendererProps {
  content: import('@/contracts').ExerciseContent
  answerSpec: import('@/contracts').AnswerSpec
  questionType: 'mcq' | 'true_false' | 'free_response'
  mode?: PreviewMode
  showCheckAnswer?: boolean
  onAnswerChange?: (answer: UserAnswer) => void
  initialAnswer?: UserAnswer
  className?: string
}
