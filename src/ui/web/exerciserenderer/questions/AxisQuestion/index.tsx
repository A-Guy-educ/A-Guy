'use client'

import React from 'react'
import type { QuestionAxisBlock, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import { AxisRenderer } from '../../blocks/AxisRenderer'
import { GenericAnswerInput } from '../shared/GenericAnswerInput'

interface AxisQuestionProps {
  question: QuestionAxisBlock
  answer: UserAnswer
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
  displayOnly?: boolean
}

export function AxisQuestion({
  question,
  answer,
  onChange,
  disabled,
  checkResult,
  t,
  displayOnly,
}: AxisQuestionProps) {
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

      <AxisRenderer blockId={question.id} spec={question.axis} />

      {!displayOnly && question.answer && (
        <GenericAnswerInput
          answerSpec={question.answer}
          userAnswer={answer}
          answerType="axis"
          onChange={onChange}
          disabled={disabled}
          checkResult={checkResult}
          t={t}
        />
      )}
    </div>
  )
}
