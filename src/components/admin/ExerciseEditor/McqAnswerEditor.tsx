'use client'

/**
 * MCQ Answer Spec Editor
 */

import React from 'react'
import type { McqAnswerSpec } from '@/contracts'
import type { AnswerSpecEditorProps } from '../shared/types'
import { ErrorDisplay } from '../shared/ErrorDisplay'
import { generateBlockId } from '../shared/utils'

export function McqAnswerEditor({ value, onChange, errors }: AnswerSpecEditorProps) {
  const mcqValue = value as McqAnswerSpec

  const addOption = () => {
    const newOption = {
      id: `opt_${Date.now()}`,
      content: [
        {
          id: generateBlockId(),
          type: 'rich_text' as const,
          format: 'md-math-v1' as const,
          value: 'New option',
        },
      ],
    }
    onChange({
      ...mcqValue,
      options: [...mcqValue.options, newOption],
    })
  }

  const removeOption = (optionId: string) => {
    onChange({
      ...mcqValue,
      options: mcqValue.options.filter((opt) => opt.id !== optionId),
      correctOptionIds: mcqValue.correctOptionIds.filter((id) => id !== optionId),
    })
  }

  const updateOption = (optionId: string, content: (typeof mcqValue.options)[0]['content']) => {
    onChange({
      ...mcqValue,
      options: mcqValue.options.map((opt) => (opt.id === optionId ? { ...opt, content } : opt)),
    })
  }

  const toggleCorrect = (optionId: string) => {
    const isCurrentlyCorrect = mcqValue.correctOptionIds.includes(optionId)

    if (mcqValue.multiSelect) {
      // Multi-select: toggle on/off
      onChange({
        ...mcqValue,
        correctOptionIds: isCurrentlyCorrect
          ? mcqValue.correctOptionIds.filter((id) => id !== optionId)
          : [...mcqValue.correctOptionIds, optionId],
      })
    } else {
      // Single-select: replace
      onChange({
        ...mcqValue,
        correctOptionIds: [optionId],
      })
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3>MCQ Options</h3>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
        >
          <input
            type="checkbox"
            checked={mcqValue.multiSelect}
            onChange={(e) =>
              onChange({
                ...mcqValue,
                multiSelect: e.target.checked,
                // If switching to single-select, keep only first correct option
                correctOptionIds: e.target.checked
                  ? mcqValue.correctOptionIds
                  : mcqValue.correctOptionIds.slice(0, 1),
              })
            }
          />
          Allow multiple selection
        </label>
      </div>

      <ErrorDisplay errors={errors} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
        {mcqValue.options.map((option, idx) => {
          const isCorrect = mcqValue.correctOptionIds.includes(option.id)
          const richTextBlock =
            option.content.length > 0 && option.content[0].type === 'rich_text'
              ? option.content[0]
              : {
                  id: generateBlockId(),
                  type: 'rich_text' as const,
                  format: 'md-math-v1' as const,
                  value: '',
                }

          return (
            <div
              key={option.id}
              style={{
                border: isCorrect
                  ? '2px solid var(--theme-success-500)'
                  : '1px solid var(--theme-elevation-150)',
                borderRadius: '4px',
                padding: '1rem',
                background: isCorrect ? 'var(--theme-success-50)' : 'transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Option {idx + 1}</span>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    <input
                      type={mcqValue.multiSelect ? 'checkbox' : 'radio'}
                      name="correct-option"
                      checked={isCorrect}
                      onChange={() => toggleCorrect(option.id)}
                    />
                    <span style={{ fontWeight: isCorrect ? '500' : 'normal' }}>
                      {isCorrect ? 'Correct Answer' : 'Mark as correct'}
                    </span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeOption(option.id)}
                  className="btn btn--style-secondary btn--size-small"
                >
                  Remove Option
                </button>
              </div>

              {/* Rich text content editor - simplified for option */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                  Option Text
                </label>
                <textarea
                  value={richTextBlock.value}
                  onChange={(e) =>
                    updateOption(option.id, [
                      {
                        ...richTextBlock,
                        value: e.target.value,
                      },
                    ])
                  }
                  style={{
                    width: '100%',
                    height: '6rem',
                    padding: '0.75rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  }}
                  placeholder="Enter option text (supports markdown and math: $x^2$)"
                />
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addOption}
        className="btn btn--style-secondary btn--size-small"
        style={{ marginBottom: '1rem' }}
      >
        + Add Option
      </button>

      {mcqValue.options.length > 0 && mcqValue.correctOptionIds.length === 0 && (
        <div className="field-error" style={{ marginTop: '0.75rem', padding: '0.75rem' }}>
          ⚠️ You must mark at least one option as correct
        </div>
      )}
    </div>
  )
}
