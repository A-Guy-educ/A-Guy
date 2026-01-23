/**
 * Free Response Question Component
 * Displays a question with a text input for free-form answers
 */

'use client'

import React from 'react'
import { Input } from '@/ui/ui/input'
import type { QuestionFreeResponseBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface FreeResponseQuestionProps {
  question: QuestionFreeResponseBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
}

export function FreeResponseQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult: _checkResult,
  t,
}: FreeResponseQuestionProps) {
  const value = answer.type === 'free_response' ? answer.value : ''

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
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
        disabled={disabled}
        placeholder={t('enterAnswer')}
        className="text-base p-6"
      />
    </div>
  )
}
