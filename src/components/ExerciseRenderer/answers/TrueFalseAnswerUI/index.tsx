/**
 * True/False Answer UI
 * Sections variant - multiple true/false items with individual prompts
 * NOTE: This component is deprecated and not used in the new block-based exercise structure
 */

import React from 'react'
import { cn } from '@/utilities/ui'
import type { TrueFalseAnswerSpec } from '@/contracts'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'
import './index.scss'

const baseClass = 'true-false-answer-ui'

// Legacy UserAnswer type for the old sections-based true/false format
type LegacyTrueFalseAnswer = {
  type: 'true_false'
  sections: Record<string, boolean | null>
}

interface TrueFalseAnswerUIProps {
  spec: TrueFalseAnswerSpec
  value: LegacyTrueFalseAnswer
  onChange: (value: LegacyTrueFalseAnswer) => void
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
  const sections = value.type === 'true_false' ? value.sections : {}

  const handleSectionChange = (sectionId: string, boolValue: boolean) => {
    if (disabled) return
    onChange({
      type: 'true_false',
      sections: {
        ...sections,
        [sectionId]: boolValue,
      },
    })
  }

  const renderSectionOption = (sectionId: string, boolValue: boolean, label: string) => {
    const selectedValue = sections[sectionId]
    const isSelected = selectedValue === boolValue
    const item = spec.items.find((i) => i.id === sectionId)
    const isCorrect = item?.correct === boolValue
    const showAsCorrect = showCorrect && isCorrect

    return (
      <button
        type="button"
        onClick={() => handleSectionChange(sectionId, boolValue)}
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
      {spec.items.map((item) => (
        <div key={item.id} className={`${baseClass}__section`}>
          <div className={`${baseClass}__section-header`}>
            <span className={`${baseClass}__section-label`}>{item.label}.</span>
          </div>
          <div className={`${baseClass}__section-prompt`}>
            <RichTextRenderer block={item.prompt} />
          </div>
          <div className={`${baseClass}__options`}>
            {renderSectionOption(item.id, true, 'True')}
            {renderSectionOption(item.id, false, 'False')}
          </div>
        </div>
      ))}
    </div>
  )
}
