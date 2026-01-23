/**
 * Answer Renderer Dispatcher
 * Routes different answer types to their specific UI components
 * NOTE: This component is deprecated and not used in the new block-based exercise structure
 */

import type { AnswerSpec } from '@/infra/contracts'
import type { PreviewMode } from '../../types'
import { FreeResponseAnswerUI } from '../FreeResponseAnswerUI'
import { McqAnswerUI } from '../McqAnswerUI'
import { TrueFalseAnswerUI } from '../TrueFalseAnswerUI'

// Legacy UserAnswer types for backward compatibility
type LegacyUserAnswer =
  | { type: 'mcq'; selectedIds: string[] }
  | { type: 'true_false'; sections: Record<string, boolean | null> }
  | { type: 'free_response'; value: string }

interface AnswerRendererProps {
  answerSpec: AnswerSpec
  value: LegacyUserAnswer
  onChange: (value: LegacyUserAnswer) => void
  disabled?: boolean
  mode?: PreviewMode
}

export function AnswerRenderer({
  answerSpec,
  value,
  onChange,
  disabled = false,
  mode = 'student',
}: AnswerRendererProps) {
  const showCorrect = mode === 'debug'

  switch (answerSpec.questionType) {
    case 'mcq':
      return (
        <McqAnswerUI
          spec={answerSpec}
          value={value as Extract<LegacyUserAnswer, { type: 'mcq' }>}
          onChange={onChange}
          disabled={disabled}
          showCorrect={showCorrect}
        />
      )

    case 'true_false':
      return (
        <TrueFalseAnswerUI
          spec={answerSpec}
          value={value as Extract<LegacyUserAnswer, { type: 'true_false' }>}
          onChange={onChange as (value: Extract<LegacyUserAnswer, { type: 'true_false' }>) => void}
          disabled={disabled}
          showCorrect={showCorrect}
        />
      )

    case 'free_response':
      return (
        <FreeResponseAnswerUI
          spec={answerSpec}
          value={value as Extract<LegacyUserAnswer, { type: 'free_response' }>}
          onChange={onChange}
          disabled={disabled}
        />
      )

    default:
      return (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-yellow-700 dark:text-yellow-300">
          <span className="text-xl">⚠️</span>
          <span>Unknown answer type</span>
        </div>
      )
  }
}
