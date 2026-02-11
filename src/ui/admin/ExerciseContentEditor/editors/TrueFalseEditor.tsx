'use client'

import React from 'react'
import type { QuestionSelectTrueFalseBlock } from '@/shared/exercise-content/types'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { HintSolutionPanel } from './HintSolutionPanel'

interface TrueFalseEditorProps {
  block: QuestionSelectTrueFalseBlock
  onChange: (block: QuestionSelectTrueFalseBlock) => void
}

export const TrueFalseEditor: React.FC<TrueFalseEditorProps> = ({ block, onChange }) => {
  const correctOptionId = block.answer.correctOptionId || 'true'

  const trueOption = block.options?.[0]
  const falseOption = block.options?.[1]

  const trueLabel = trueOption?.label?.value ?? 'True'
  const falseLabel = falseOption?.label?.value ?? 'False'

  const updateOptionLabel = (optionIndex: number, newValue: string) => {
    if (!block.options) return

    const newOptions = block.options.map((opt, i) =>
      i === optionIndex ? { ...opt, label: { ...opt.label, value: newValue } } : opt,
    ) as typeof block.options

    onChange({ ...block, options: newOptions })
  }

  return (
    <div className="true-false-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(newPrompt) => onChange({ ...block, prompt: newPrompt })}
          placeholder="Enter your True/False question..."
        />
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Options</label>
        <div className="tf-option-row">
          <button
            type="button"
            className={`tf-radio-option ${correctOptionId === 'true' ? 'tf-radio-option--selected' : ''}`}
            onClick={() => onChange({ ...block, answer: { correctOptionId: 'true' } })}
          >
            <span className="tf-radio-indicator" />
            <input
              type="text"
              className="tf-option-input"
              value={trueLabel}
              onChange={(e) => updateOptionLabel(0, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Option label"
            />
          </button>
          <button
            type="button"
            className={`tf-radio-option ${correctOptionId === 'false' ? 'tf-radio-option--selected' : ''}`}
            onClick={() => onChange({ ...block, answer: { correctOptionId: 'false' } })}
          >
            <span className="tf-radio-indicator" />
            <input
              type="text"
              className="tf-option-input"
              value={falseLabel}
              onChange={(e) => updateOptionLabel(1, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Option label"
            />
          </button>
        </div>
      </div>

      <div className="question-editor-section">
        <HintSolutionPanel
          hint={block.hint}
          solution={block.solution}
          fullSolution={block.fullSolution}
          onChange={(field, value) => onChange({ ...block, [field]: value })}
        />
      </div>
    </div>
  )
}
