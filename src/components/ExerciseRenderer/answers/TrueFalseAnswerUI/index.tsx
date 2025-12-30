/**
 * True/False Answer UI
 * Simple true/false selection interface
 */

import React from 'react'
import { cn } from '@/utilities/ui'
import type { TrueFalseAnswerSpec } from '@/contracts'
import type { UserAnswer } from '../../types'
import './index.scss'

const baseClass = 'true-false-answer-ui'

interface TrueFalseAnswerUIProps {
  spec: TrueFalseAnswerSpec
  value: UserAnswer
  onChange: (value: UserAnswer) => void
  disabled?: boolean
  showCorrect?: boolean
}

export function TrueFalseAnswerUI({
  spec,
  value,
  onChange,
  disabled = false,
  showCorrect = false,
}: TrueFalseAnswerUIProps) {
  const selectedValue = value.type === 'true_false' ? value.value : null

  const handleSelect = (boolValue: boolean) => {
    if (disabled) return
    onChange({ type: 'true_false', value: boolValue })
  }

  const renderOption = (boolValue: boolean, label: string) => {
    const isSelected = selectedValue === boolValue
    const isCorrect = spec.correct === boolValue
    const showAsCorrect = showCorrect && isCorrect

    return (
      <button
        type="button"
        onClick={() => handleSelect(boolValue)}
        disabled={disabled}
        className={cn(
          `${baseClass}__option`,
          isSelected && `${baseClass}__option--selected`,
          showAsCorrect && `${baseClass}__option--correct`,
          disabled && `${baseClass}__option--disabled`,
        )}
      >
        <span className={`${baseClass}__label`}>{label}</span>
        {showAsCorrect && <span className={`${baseClass}__correct-icon`}>✓</span>}
      </button>
    )
  }

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__options`}>
        {renderOption(true, 'True')}
        {renderOption(false, 'False')}
      </div>
    </div>
  )
}
