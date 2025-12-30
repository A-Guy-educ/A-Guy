/**
 * MCQ Answer UI
 * Interactive multiple choice interface for students
 */

import React from 'react'
import { cn } from '@/utilities/ui'
import type { McqAnswerSpec } from '@/contracts'
import type { UserAnswer } from '../../types'
import { BlockRenderer } from '../../blocks/BlockRenderer'
import './index.scss'

const baseClass = 'mcq-answer-ui'

interface McqAnswerUIProps {
  spec: McqAnswerSpec
  value: UserAnswer
  onChange: (value: UserAnswer) => void
  disabled?: boolean
  showCorrect?: boolean // For debug mode
}

export function McqAnswerUI({
  spec,
  value,
  onChange,
  disabled = false,
  showCorrect = false,
}: McqAnswerUIProps) {
  const selectedIds = value.type === 'mcq' ? value.selectedIds : []

  const handleOptionClick = (optionId: string) => {
    if (disabled) return

    let newSelectedIds: string[]

    if (spec.multiSelect) {
      // Multi-select: toggle on/off
      if (selectedIds.includes(optionId)) {
        newSelectedIds = selectedIds.filter((id) => id !== optionId)
      } else {
        newSelectedIds = [...selectedIds, optionId]
      }
    } else {
      // Single-select: replace
      newSelectedIds = [optionId]
    }

    onChange({ type: 'mcq', selectedIds: newSelectedIds })
  }

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__instruction`}>
        {spec.multiSelect ? 'Select all that apply' : 'Select one answer'}
      </div>

      <div className={`${baseClass}__options`}>
        {spec.options.map((option) => {
          const isSelected = selectedIds.includes(option.id)
          const isCorrect = spec.correctOptionIds.includes(option.id)
          const showAsCorrect = showCorrect && isCorrect

          return (
            <label
              key={option.id}
              className={cn(
                `${baseClass}__option`,
                isSelected && `${baseClass}__option--selected`,
                showAsCorrect && `${baseClass}__option--correct`,
                disabled && `${baseClass}__option--disabled`,
              )}
              onClick={() => handleOptionClick(option.id)}
            >
              <input
                type={spec.multiSelect ? 'checkbox' : 'radio'}
                name="mcq-option"
                checked={isSelected}
                onChange={() => handleOptionClick(option.id)}
                disabled={disabled}
                className={`${baseClass}__input`}
              />
              <div className={`${baseClass}__content`}>
                {option.content.map((block) => (
                  <BlockRenderer key={block.id} block={block} />
                ))}
                {showAsCorrect && (
                  <div className={`${baseClass}__correct-label`}>✓ Correct Answer</div>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
