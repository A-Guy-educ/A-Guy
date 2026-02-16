/**
 * True/False Question Component
 * Displays a True/False question with immediate feedback
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { CheckCircle2, XCircle } from 'lucide-react'
import type {
  QuestionSelectTrueFalseBlock,
  UserAnswer,
  CheckResult,
  RichTextBlock,
} from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

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
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className="flex gap-3">
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
                'flex-1 relative overflow-hidden px-6 py-4 rounded-lg border-2 font-medium text-base transition-all duration-200',
                'border-border bg-card',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                !disabled && 'hover:border-muted-foreground hover:bg-muted cursor-pointer',
                isSelected &&
                  !showFeedback &&
                  'border-primary bg-primary/10 text-primary shadow-sm',
                showFeedback &&
                  isSelected &&
                  checkResult.isCorrect &&
                  'border-success bg-success/10 text-success shadow-sm',
                showFeedback &&
                  isSelected &&
                  !checkResult.isCorrect &&
                  'border-destructive bg-destructive/10 text-destructive shadow-sm',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <RichTextRenderer block={labelBlock} />
                {showFeedback && isSelected && (
                  <span className="text-xl font-bold">
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
