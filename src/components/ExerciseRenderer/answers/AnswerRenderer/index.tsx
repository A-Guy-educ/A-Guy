/**
 * Answer Renderer Dispatcher
 * Routes different answer types to their specific UI components
 */

import React from 'react'
import type { AnswerSpec } from '@/contracts'
import type { UserAnswer, PreviewMode } from '../../types'
import { McqAnswerUI } from '../McqAnswerUI'
import { TrueFalseAnswerUI } from '../TrueFalseAnswerUI'
import { FreeResponseAnswerUI } from '../FreeResponseAnswerUI'
import './index.scss'

const baseClass = 'answer-renderer'

interface AnswerRendererProps {
  answerSpec: AnswerSpec
  value: UserAnswer
  onChange: (value: UserAnswer) => void
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
          value={value}
          onChange={onChange}
          disabled={disabled}
          showCorrect={showCorrect}
        />
      )

    case 'true_false':
      return (
        <TrueFalseAnswerUI
          spec={answerSpec}
          value={value}
          onChange={onChange}
          disabled={disabled}
          showCorrect={showCorrect}
        />
      )

    case 'free_response':
      return (
        <FreeResponseAnswerUI
          spec={answerSpec}
          value={value}
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
