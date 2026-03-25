/**
 * Multiple Choice Question Component
 * Displays a question with multiple choice options (single or multi-select)
 */

'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import { Checkbox } from '@/ui/web/components/checkbox'
import { AlertCircle } from 'lucide-react'
import type { QuestionSelectMcqBlock, UserAnswer, CheckResult } from '../../types'
import type { RichContent } from '@/server/payload/collections/Exercises/types'
import { ContentSlotRenderer } from '../../blocks/ContentSlotRenderer'

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

  return (
    <div className="flex flex-col gap-content-gap">
      <div className="text-body-md font-medium text-foreground leading-relaxed">
        <ContentSlotRenderer content={question.prompt as RichContent} />
      </div>
      <div className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
        <AlertCircle className="w-4 h-4" />
        {question.answer.multiSelect ? t('selectMultiple') : t('selectOne')}
      </div>
      <div className="flex flex-col gap-3">
        {question.answer.options.map((option) => {
          const isSelected = selectedIds.includes(option.id)
          return (
            <label
              key={option.id}
              className={cn(
                'flex items-start gap-3 p-card-padding-sm rounded-lg border-2 transition-all duration-normal cursor-pointer',
                'border-border bg-card',
                !disabled && 'hover:border-muted-foreground hover:bg-muted',
                'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                isSelected && 'border-primary bg-primary/10 shadow-elevation-1',
                disabled && 'opacity-60 cursor-not-allowed',
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
                    'w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all',
                    'border-border bg-background',
                    isSelected && 'border-primary bg-primary',
                  )}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
                </div>
              )}
              <div className="flex-1 text-body-lg text-foreground">
                <ContentSlotRenderer content={option.content as RichContent} />
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
