/**
 * True/False Question Component
 * Displays a True/False question with card-style options and animated feedback
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
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
    <div className="flex flex-col gap-content-gap">
      <div className="text-body-md font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className="grid grid-cols-2 gap-content-gap">
        {options.map((option, index) => {
          const isSelected = value === option.value
          const showFeedback = checkResult !== null

          const labelBlock: RichTextBlock = {
            ...option.label,
            id: `${question.id}-option-${option.id}`,
            mediaIds: option.label.mediaIds || [],
          }

          return (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => onChange({ type: 'true_false', value: option.value })}
              disabled={disabled}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={!disabled ? { y: -2 } : undefined}
              whileTap={!disabled ? { scale: 0.97 } : undefined}
              className={cn(
                'relative overflow-hidden rounded-xl border-2 p-5 text-heading-sm font-bold transition-all duration-normal',
                'bg-card shadow-elevation-1',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                !disabled &&
                  !isSelected &&
                  'border-border/30 hover:border-primary/30 hover:shadow-card-hover cursor-pointer',
                isSelected && !showFeedback && 'border-primary bg-primary/8 shadow-elevation-2',
                showFeedback &&
                  isSelected &&
                  checkResult.isCorrect &&
                  'border-success bg-success/8 shadow-elevation-2',
                showFeedback &&
                  isSelected &&
                  !checkResult.isCorrect &&
                  'border-destructive bg-destructive/8 shadow-elevation-2',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <div className="flex items-center justify-center gap-content-gap-xs">
                <RichTextRenderer block={labelBlock} />
              </div>

              {/* Feedback badge overlay */}
              {showFeedback && isSelected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className={cn(
                    'absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full flex items-center justify-center',
                    checkResult.isCorrect ? 'bg-success text-white' : 'bg-destructive text-white',
                  )}
                >
                  {checkResult.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </motion.span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
