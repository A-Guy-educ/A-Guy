/**
 * MCQ Answer UI
 * Interactive multiple choice interface for students
 * NOTE: This component is deprecated and not used in the new block-based exercise structure
 */

import React from 'react'
import { cn } from '@/utilities/ui'
import type { McqAnswerSpec } from '@/contracts'
import { BlockRenderer } from '../../blocks/BlockRenderer'

// Legacy UserAnswer type
type LegacyMcqAnswer = { type: 'mcq'; selectedIds: string[] }

interface McqAnswerUIProps {
  spec: McqAnswerSpec
  value: LegacyMcqAnswer
  onChange: (value: LegacyMcqAnswer) => void
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
    <div>
      <div className="mb-2 text-sm opacity-80">
        {spec.multiSelect ? 'Select all that apply' : 'Select one answer'}
      </div>

      <div className="flex flex-col gap-3">
        {spec.options.map((option) => {
          const isSelected = selectedIds.includes(option.id)
          const isCorrect = spec.correctOptionIds.includes(option.id)
          const showAsCorrect = showCorrect && isCorrect

          return (
            <label
              key={option.id}
              className={cn(
                'flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all duration-normal',
                'bg-background hover:bg-muted hover:border-muted-foreground',
                isSelected && 'border-2 border-primary bg-primary/5',
                showAsCorrect && 'border-2 border-success bg-success/5',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
              onClick={() => handleOptionClick(option.id)}
            >
              <input
                type={spec.multiSelect ? 'checkbox' : 'radio'}
                name="mcq-option"
                checked={isSelected}
                onChange={() => handleOptionClick(option.id)}
                disabled={disabled}
                className="w-5 h-5 mt-0.5 shrink-0 cursor-inherit"
              />
              <div className="flex-1">
                {option.content.map((block) => (
                  <BlockRenderer key={block.id} block={block} />
                ))}
                {showAsCorrect && (
                  <div className="mt-2 text-xs text-success font-medium">✓ Correct Answer</div>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
