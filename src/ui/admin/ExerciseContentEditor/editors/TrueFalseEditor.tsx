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
        <label className="question-editor-label">Correct Answer</label>
        <div className="tf-radio-group">
          <button
            type="button"
            className={`tf-radio-option ${correctOptionId === 'true' ? 'tf-radio-option--selected' : ''}`}
            onClick={() => onChange({ ...block, answer: { correctOptionId: 'true' } })}
          >
            True
          </button>
          <button
            type="button"
            className={`tf-radio-option ${correctOptionId === 'false' ? 'tf-radio-option--selected' : ''}`}
            onClick={() => onChange({ ...block, answer: { correctOptionId: 'false' } })}
          >
            False
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
