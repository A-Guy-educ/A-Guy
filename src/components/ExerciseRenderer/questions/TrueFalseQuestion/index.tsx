/**
 * True/False Question Component
 * Displays a True/False question with immediate feedback
 */

'use client'

import React from 'react'
import { cn } from '@/utilities/ui'
import { CheckCircle2, XCircle } from 'lucide-react'
import type {
  QuestionSelectTrueFalseBlock,
  UserAnswer,
  CheckResult,
  RichTextBlock,
} from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import './index.scss'

interface TrueFalseQuestionProps {
  question: QuestionSelectTrueFalseBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
}

export function TrueFalseQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult,
}: TrueFalseQuestionProps) {
  const value = answer.type === 'true_false' ? answer.value : null

  // Fallback for backward compatibility - generate default options if missing
  const options = question.options || [
    {
      id: 'true' as const,
      value: true as const,
      label: {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'True',
        mediaIds: [] as string[],
      },
    },
    {
      id: 'false' as const,
      value: false as const,
      label: {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: 'False',
        mediaIds: [] as string[],
      },
    },
  ]

  // Convert InlineRichText to RichTextBlock for renderer
  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  return (
    <div className="true-false-question">
      <div className="true-false-question__prompt">
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className="true-false-question__options">
        {options.map((option) => {
          const isSelected = value === option.value
          const showFeedback = checkResult !== null

          const labelBlock: RichTextBlock = {
            ...option.label,
            id: `${question.id}-option-${option.id}`,
            mediaIds: option.label.mediaIds || [],
          }
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ type: 'true_false', value: option.value })}
              disabled={disabled}
              className={cn(
                'true-false-question__option',
                isSelected && !showFeedback && 'true-false-question__option--selected',
                showFeedback &&
                  isSelected &&
                  checkResult.isCorrect &&
                  'true-false-question__option--correct',
                showFeedback &&
                  isSelected &&
                  !checkResult.isCorrect &&
                  'true-false-question__option--incorrect',
                disabled && 'true-false-question__option--disabled',
              )}
            >
              <div className="true-false-question__option-content">
                <RichTextRenderer block={labelBlock} />
                {showFeedback && isSelected && (
                  <span className="true-false-question__option-icon">
                    {checkResult.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
