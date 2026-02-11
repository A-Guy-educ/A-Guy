/**
 * Free Response Question Component
 * Displays a question with a text input for free-form answers
 */

'use client'

import React from 'react'
import { Textarea } from '@/ui/web/components/textarea'
import type { QuestionFreeResponseBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface FreeResponseQuestionProps {
  question: QuestionFreeResponseBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
  subLabel?: string | null
}

export function FreeResponseQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult: _checkResult,
  t,
  subLabel,
}: FreeResponseQuestionProps) {
  const value = answer?.type === 'free_response' ? answer.value : ''

  // Convert InlineRichText to RichTextBlock for renderer
  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        {subLabel && (
          <span
            data-testid={`statement-label-${subLabel}`}
            className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-medium border border-primary/20 me-2"
          >
            {subLabel}
          </span>
        )}
        <RichTextRenderer block={promptBlock} />
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
        disabled={disabled}
        placeholder={t('enterAnswer')}
        className="text-base p-4 min-h-[120px] resize-y"
        rows={4}
      />
    </div>
  )
}
