/**
 * True/False Answer UI
 * Sections variant - multiple true/false items with individual prompts
 * NOTE: This component is deprecated and not used in the new block-based exercise structure
 */

import React from 'react'
import { cn } from '@/utilities/ui'
import type { TrueFalseAnswerSpec } from '@/contracts'
import { RichTextRenderer } from '../../blocks/RichTextRenderer'

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
          'px-6 py-2 border rounded-lg font-medium transition-all duration-normal',
          'hover:bg-muted',
          isSelected && 'bg-primary text-primary-foreground border-primary',
          showAsCorrect && 'bg-success text-white border-success',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <span>{label}</span>
        {showAsCorrect && <span className="ml-2">✓</span>}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {spec.items.map((item) => (
        <div key={item.id} className="space-y-3">
          <div className="font-medium text-sm">
            <span>{item.label}.</span>
          </div>
          <div className="text-base">
            <RichTextRenderer block={item.prompt} />
          </div>
          <div className="flex gap-3">
            {renderSectionOption(item.id, true, 'True')}
            {renderSectionOption(item.id, false, 'False')}
          </div>
        </div>
      ))}
    </div>
  )
}
