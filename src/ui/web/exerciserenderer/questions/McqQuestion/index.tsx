/**
 * Multiple Choice Question Component
 * Displays a question with multiple choice option cards (single or multi-select)
 */

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/infra/utils/ui'
import { Checkbox } from '@/ui/web/components/checkbox'
import { AlertCircle } from 'lucide-react'
import type { QuestionSelectMcqBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface McqQuestionProps {
  question: QuestionSelectMcqBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
}

/**
 * Transform \frac to \dfrac for display-style fractions in MCQ options
 * This improves readability by rendering fractions larger
 * Note: \frac does not occur as substring in \dfrac, so simple replacement is safe
 */
function transformFractionsToDisplayStyle(content: string): string {
  return content.replace(/\\frac\b/g, '\\dfrac')
}

export function McqQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult: _checkResult,
  t,
}: McqQuestionProps) {
  const selectedIds = answer.type === 'mcq' ? answer.selectedIds : []

  const handleOptionClick = (optionId: string) => {
    if (disabled) return

    let newSelectedIds: string[]
    if (question.answer.multiSelect) {
      newSelectedIds = selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId]
    } else {
      newSelectedIds = [optionId]
    }

    onChange({ type: 'mcq', selectedIds: newSelectedIds })
  }

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
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-body-xs border border-border/20 w-fit">
        <AlertCircle className="w-3.5 h-3.5" />
        {question.answer.multiSelect ? t('selectMultiple') : t('selectOne')}
      </div>
      <div className="flex flex-col gap-3.5">
        {question.answer.options.map((option, index) => {
          const isSelected = selectedIds.includes(option.id)
          // Transform fractions to display style for better readability in MCQ options
          const transformedValue = transformFractionsToDisplayStyle(option.content.value)
          const optionBlock: RichTextBlock = {
            ...option.content,
            value: transformedValue,
            id: `${question.id}-option-${option.id}`,
            mediaIds: option.content.mediaIds || [],
          }
          return (
            <motion.label
              key={option.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06 }}
              whileHover={!disabled ? { y: -2 } : undefined}
              className={cn(
                'flex items-start gap-3 p-card-padding-sm rounded-xl border-2 transition-all duration-normal cursor-pointer',
                'bg-card shadow-elevation-1',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                !disabled &&
                  !isSelected &&
                  'border-border/30 hover:border-primary/20 hover:shadow-card-hover',
                isSelected && 'border-primary bg-primary/6 shadow-elevation-2',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              onClick={() => !question.answer.multiSelect && handleOptionClick(option.id)}
            >
              {question.answer.multiSelect ? (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleOptionClick(option.id)}
                  disabled={disabled}
                  className="mt-0.5"
                />
              ) : (
                <div
                  className={cn(
                    'w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0',
                    'border-border bg-background',
                    isSelected && 'border-primary bg-primary ring-2 ring-primary/20 ring-offset-2',
                  )}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="w-2.5 h-2.5 rounded-full bg-primary-foreground"
                    />
                  )}
                </div>
              )}
              <div className="flex-1 text-body-lg text-foreground">
                <RichTextRenderer block={optionBlock} />
              </div>
            </motion.label>
          )
        })}
      </div>
    </div>
  )
}
