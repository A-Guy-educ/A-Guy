/**
 * Answer Renderer Dispatcher
 * Routes different answer types to their specific UI components
 * NOTE: This component is deprecated and not used in the new block-based exercise structure
 */

import React from 'react'
import type { AnswerSpec } from '@/contracts'
import type { PreviewMode } from '../../types'
import { McqAnswerUI } from '../McqAnswerUI'
import { TrueFalseAnswerUI } from '../TrueFalseAnswerUI'
import { FreeResponseAnswerUI } from '../FreeResponseAnswerUI'
import './index.scss'

const baseClass = 'answer-renderer'

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
        <div className={`${baseClass} ${baseClass}--unknown`}>
          <span className={`${baseClass}__icon`}>⚠️</span>
          <span>Unknown answer type</span>
        </div>
      )
  }
}
