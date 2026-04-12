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
      {/* Question container */}
      <div className="rounded-2xl border border-border/40 bg-background/60 dark:bg-card dark:border-border/60 dark:shadow-card p-content-gap">
        <div
          className="w-8 h-1 rounded-full mb-3"
          style={{ backgroundColor: 'hsl(var(--tab-practice))' }}
        />
        <div className="text-body-md font-medium text-foreground leading-relaxed">
          <RichTextRenderer block={promptBlock} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-content-gap">
        {options.map((option, index) => {
          const isSelected = value === option.value
          const showFeedback = checkResult !== null
          // True = blue, False = orange-red — distinct identities
          const optionColor = option.value === true ? 'hsl(217 91% 60%)' : 'hsl(25 95% 53%)'

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
                'bg-background/50 dark:bg-card dark:shadow-card',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                !disabled &&
                  !isSelected &&
                  'border-border/40 dark:border-border/50 hover:border-[hsl(var(--tab-practice)/0.5)] dark:hover:shadow-card-hover cursor-pointer',
                isSelected &&
                  !showFeedback &&
                  `border-[hsl(var(--tab-practice))] bg-[hsl(var(--tab-practice)/0.08)]`,
                showFeedback &&
                  isSelected &&
                  checkResult.isCorrect &&
                  'border-success bg-success/10',
                showFeedback &&
                  isSelected &&
                  !checkResult.isCorrect &&
                  'border-destructive bg-destructive/10',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {/* Colored top accent bar */}
              <div
                className="absolute top-0 start-0 end-0 h-1 rounded-t-xl"
                style={{
                  backgroundColor: isSelected ? optionColor : 'transparent',
                  opacity: isSelected ? 1 : 0,
                  transition: 'all 0.2s',
                }}
              />
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
                    'absolute -top-1.5 -end-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-elevation-2',
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
