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
import './index.scss'

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
  checkResult,
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
    <div className="mcq-question">
      <div className="mcq-question__prompt">
        <RichTextRenderer block={promptBlock} />
      </div>
      <div className="mcq-question__hint">
        <AlertCircle className="w-4 h-4" />
        {question.answer.multiSelect ? t('selectMultiple') : t('selectOne')}
      </div>
      <div className="mcq-question__options">
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
                'mcq-question__option',
                isSelected && 'mcq-question__option--selected',
                disabled && 'mcq-question__option--disabled',
              )}
            >
              {question.answer.multiSelect ? (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => handleOptionClick(option.id)}
                  disabled={disabled}
                  className="mcq-question__checkbox"
                />
              ) : (
                <div
                  className={cn(
                    'mcq-question__radio',
                    isSelected && 'mcq-question__radio--selected',
                  )}
                >
                  {isSelected && <div className="mcq-question__radio-dot" />}
                </div>
              )}
              <div className="mcq-question__option-content">
                <RichTextRenderer block={optionBlock} />
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
