'use client'

import React from 'react'
import { cn } from '@/infra/utils/ui'
import type { QuestionAnswer, UserAnswer, CheckResult, RichTextBlock } from '../../types'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

interface GenericAnswerInputProps {
  answerSpec: QuestionAnswer
  userAnswer: UserAnswer
  answerType: 'geometry' | 'axis'
  onChange: (answer: UserAnswer) => void
  disabled: boolean
  checkResult: CheckResult | null
  t: (key: string) => string
}

export function GenericAnswerInput({
  answerSpec,
  userAnswer,
  answerType,
  onChange,
  disabled,
  checkResult,
  t,
}: GenericAnswerInputProps) {
  const baseAnswer =
    userAnswer.type === answerType ? userAnswer : { type: answerType, kind: answerSpec.kind }

  const borderClass = checkResult
    ? checkResult.isCorrect
      ? 'border-success'
      : 'border-destructive'
    : 'border-border'

  switch (answerSpec.kind) {
    case 'numeric':
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="any"
            value={
              'numericValue' in baseAnswer && baseAnswer.numericValue !== undefined
                ? baseAnswer.numericValue
                : ''
            }
            onChange={(e) =>
              onChange({
                type: answerType,
                kind: 'numeric',
                numericValue: e.target.value === '' ? undefined : parseFloat(e.target.value),
              } as UserAnswer)
            }
            disabled={disabled}
            placeholder={t('enterNumber')}
            className={cn(
              'w-48 px-3 py-2 border-2 rounded-lg bg-card text-foreground',
              borderClass,
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          />
        </div>
      )

    case 'mcq':
      return (
        <div className="flex flex-col gap-2">
          {answerSpec.options.map((option) => {
            const selectedIds =
              'selectedOptionIds' in baseAnswer ? (baseAnswer.selectedOptionIds ?? []) : []
            const isSelected = selectedIds.includes(option.id)
            const optionBlock: RichTextBlock = {
              ...option.content,
              id: `option-${option.id}`,
              mediaIds: option.content.mediaIds || [],
            }

            return (
              <button
                key={option.id}
                onClick={() => {
                  const newIds = isSelected
                    ? selectedIds.filter((id: string) => id !== option.id)
                    : [...selectedIds, option.id]
                  onChange({
                    type: answerType,
                    kind: 'mcq',
                    selectedOptionIds: newIds,
                  } as UserAnswer)
                }}
                disabled={disabled}
                className={cn(
                  'p-3 rounded-lg border-2 text-start transition-all',
                  'border-border bg-card',
                  !disabled && 'hover:border-muted-foreground cursor-pointer',
                  isSelected && 'border-primary bg-primary/10',
                  disabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <RichTextRenderer block={optionBlock} />
              </button>
            )
          })}
        </div>
      )

    case 'free_response':
      return (
        <textarea
          value={'textValue' in baseAnswer ? (baseAnswer.textValue ?? '') : ''}
          onChange={(e) =>
            onChange({
              type: answerType,
              kind: 'free_response',
              textValue: e.target.value,
            } as UserAnswer)
          }
          disabled={disabled}
          placeholder={t('enterAnswer')}
          rows={3}
          className={cn(
            'w-full px-3 py-2 border-2 rounded-lg bg-card text-foreground resize-y',
            borderClass,
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        />
      )

    case 'point':
      return (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">X:</label>
          <input
            type="number"
            step="any"
            value={
              'point' in baseAnswer && baseAnswer.point?.x !== undefined ? baseAnswer.point.x : ''
            }
            onChange={(e) => {
              const x = e.target.value === '' ? 0 : parseFloat(e.target.value)
              const currentY =
                'point' in baseAnswer && baseAnswer.point?.y !== undefined ? baseAnswer.point.y : 0
              onChange({
                type: answerType,
                kind: 'point',
                point: { x, y: currentY },
              } as UserAnswer)
            }}
            disabled={disabled}
            className={cn(
              'w-24 px-3 py-2 border-2 rounded-lg bg-card text-foreground',
              borderClass,
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          />
          <label className="text-sm font-medium">Y:</label>
          <input
            type="number"
            step="any"
            value={
              'point' in baseAnswer && baseAnswer.point?.y !== undefined ? baseAnswer.point.y : ''
            }
            onChange={(e) => {
              const y = e.target.value === '' ? 0 : parseFloat(e.target.value)
              const currentX =
                'point' in baseAnswer && baseAnswer.point?.x !== undefined ? baseAnswer.point.x : 0
              onChange({
                type: answerType,
                kind: 'point',
                point: { x: currentX, y },
              } as UserAnswer)
            }}
            disabled={disabled}
            className={cn(
              'w-24 px-3 py-2 border-2 rounded-lg bg-card text-foreground',
              borderClass,
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          />
        </div>
      )

    case 'function':
      return (
        <input
          type="text"
          value={'functionExpression' in baseAnswer ? (baseAnswer.functionExpression ?? '') : ''}
          onChange={(e) =>
            onChange({
              type: answerType,
              kind: 'function',
              functionExpression: e.target.value,
            } as UserAnswer)
          }
          disabled={disabled}
          placeholder={t('enterExpression')}
          className={cn(
            'w-full px-3 py-2 border-2 rounded-lg bg-card text-foreground font-mono',
            borderClass,
            disabled && 'opacity-60 cursor-not-allowed',
          )}
        />
      )
  }
}
