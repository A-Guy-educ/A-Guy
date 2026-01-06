/**
 * Free Response Question Component
 * Displays a question with a text input for free-form answers
 */

'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import type { QuestionFreeResponseBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import './index.scss'

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
  checkResult,
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
    <div className="free-response-question">
      <div className="free-response-question__prompt">
        <RichTextRenderer block={promptBlock} />
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
        disabled={disabled}
        placeholder={t('enterAnswer')}
        className="free-response-question__input"
      />
    </div>
  )
}
