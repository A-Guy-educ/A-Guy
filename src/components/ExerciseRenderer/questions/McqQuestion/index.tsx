/**
 * Multiple Choice Question Component
 * Displays a question with multiple choice options (single or multi-select)
 */

'use client'

import React from 'react'
import { cn } from '@/utilities/ui'
import { Checkbox } from '@/components/ui/checkbox'
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
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4" />
        {question.answer.multiSelect ? t('selectMultiple') : t('selectOne')}
      </div>
      <div className="flex flex-col gap-3">
        {question.answer.options.map((option) => {
          const isSelected = selectedIds.includes(option.id)
          const optionBlock: RichTextBlock = {
            ...option.content,
            id: `${question.id}-option-${option.id}`,
            mediaIds: option.content.mediaIds || [],
          }
          return (
            <label
              key={option.id}
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer',
                'border-border bg-card',
                !disabled && 'hover:border-primary hover:bg-primary/5',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                isSelected && 'border-primary bg-primary/10 shadow-sm',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
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
                    'w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all',
                    'border-border bg-background',
                    isSelected && 'border-primary bg-primary',
                  )}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                </div>
              )}
              <div className="flex-1 text-foreground">
                <RichTextRenderer block={optionBlock} />
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
