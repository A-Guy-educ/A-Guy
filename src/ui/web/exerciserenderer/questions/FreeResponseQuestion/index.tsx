/**
 * Free Response Question Component
 * Displays a question with a text input for free-form answers
 */

'use client'

import React, { useRef, useCallback, useLayoutEffect } from 'react'
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
}

export function FreeResponseQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult: _checkResult,
  t,
}: FreeResponseQuestionProps) {
  const value = answer?.type === 'free_response' ? answer.value : ''

  // Convert InlineRichText to RichTextBlock for renderer
  const promptBlock: RichTextBlock = {
    ...question.prompt,
    id: `${question.id}-prompt`,
    mediaIds: question.prompt.mediaIds || [],
  }

  // Auto-resize logic
  const MAX_HEIGHT = 160
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return

    el.style.height = 'auto'
    const clamped = Math.min(el.scrollHeight, MAX_HEIGHT)
    el.style.height = `${clamped}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [])

  useLayoutEffect(() => {
    autoResize()
  }, [value, autoResize])

  return (
    <div className="flex flex-col gap-4">
      <div className="text-base font-medium text-foreground leading-relaxed">
        <RichTextRenderer block={promptBlock} />
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange({ type: 'free_response', value: e.target.value })}
        disabled={disabled}
        placeholder={t('enterAnswer')}
        className="text-base min-h-0 resize-none overflow-hidden"
        rows={1}
      />
    </div>
  )
}
