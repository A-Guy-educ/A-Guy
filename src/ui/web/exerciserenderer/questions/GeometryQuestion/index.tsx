'use client'

import React from 'react'
import type { QuestionGeometryBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import { GeometryRenderer } from '../../blocks/GeometryRenderer'
import { GenericAnswerInput } from '../shared/GenericAnswerInput'

interface GeometryQuestionProps {
  question: QuestionGeometryBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
  displayOnly?: boolean
}

export function GeometryQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult,
  t,
  displayOnly,
}: GeometryQuestionProps) {
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

      <GeometryRenderer blockId={question.id} spec={question.geometry} />

      {!displayOnly && question.answer && (
        <GenericAnswerInput
          answerSpec={question.answer}
          userAnswer={answer}
          answerType="geometry"
          onChange={onChange}
          disabled={disabled}
          checkResult={checkResult}
          t={t}
        />
      )}
    </div>
  )
}
