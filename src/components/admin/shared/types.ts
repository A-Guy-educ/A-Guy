/**
 * Shared types for Exercise admin editors
 */

import type { ExerciseBlock, AnswerSpec } from '@/contracts'

export interface EditorError {
  path: string
  message: string
}

export interface BlockEditorProps<T extends ExerciseBlock = ExerciseBlock> {
  block: T
  onChange: (block: T) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  errors?: EditorError[]
}

export interface AnswerSpecEditorProps {
  value: AnswerSpec
  onChange: (value: AnswerSpec) => void
  questionType: 'mcq' | 'true_false' | 'free_response'
  errors?: EditorError[]
}
