'use client'

import React from 'react'
import type { QuestionSelectMcqBlock } from '@/infra/llm/services/exercise-content/types'
import { generateId } from '@/infra/llm/services/exercise-content/types'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { HintSolutionPanel } from './HintSolutionPanel'
import {
  changeSelectionMode,
  removeOptionAndNormalize,
  toggleCorrectOption,
  addOptionAndNormalize,
  updateOptionAndNormalize,
} from './normalizers'
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react'

interface McqEditorProps {
  block: QuestionSelectMcqBlock
  onChange: (block: QuestionSelectMcqBlock) => void
}

export const McqEditor: React.FC<McqEditorProps> = ({ block, onChange }) => {
  const handleSelectionModeChange = (mode: 'single' | 'multiple') => {
    onChange(changeSelectionMode(block, mode))
  }

  const handleToggleCorrect = (optionId: string) => {
    onChange(toggleCorrectOption(block, optionId))
  }

  const handleRemoveOption = (optionId: string) => {
    onChange(removeOptionAndNormalize(block, optionId))
  }

  const handleAddOption = () => {
    const newOption = {
      id: generateId(),
      content: {
        type: 'rich_text' as const,
        format: 'md-math-v1' as const,
        value: '',
        mediaIds: [],
      },
    }
    onChange(addOptionAndNormalize(block, newOption))
  }

  const handleOptionContentChange = (
    optionId: string,
    content: { type: 'rich_text'; format: 'md-math-v1'; value: string; mediaIds: string[] },
  ) => {
    onChange(updateOptionAndNormalize(block, optionId, { content }))
  }

  const handleMoveOption = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= block.answer.options.length) return

    const newOptions = [...block.answer.options]
    const [movedOption] = newOptions.splice(index, 1)
    newOptions.splice(newIndex, 0, movedOption)

    onChange({
      ...block,
      answer: {
        ...block.answer,
        options: newOptions,
      },
    })
  }

  return (
    <div className="mcq-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(newPrompt) => onChange({ ...block, prompt: newPrompt })}
          placeholder="Enter your multiple choice question..."
        />
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Selection Mode</label>
        <div className="mcq-selection-mode">
          <button
            type="button"
            className={`mcq-mode-btn ${block.selectionMode === 'single' ? 'mcq-mode-btn--selected' : ''}`}
            onClick={() => handleSelectionModeChange('single')}
          >
            Single Answer
          </button>
          <button
            type="button"
            className={`mcq-mode-btn ${block.selectionMode === 'multiple' ? 'mcq-mode-btn--selected' : ''}`}
            onClick={() => handleSelectionModeChange('multiple')}
          >
            Multiple Answers
          </button>
        </div>
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Options</label>
        <div className="mcq-options-list">
          {block.answer.options.map((option, index) => (
            <div key={option.id} className="mcq-option-row">
              <div className="mcq-option-correct">
                <button
                  type="button"
                  className={`mcq-correct-marker ${block.answer.correctOptionIds.includes(option.id) ? 'mcq-correct-marker--checked' : ''}`}
                  onClick={() => handleToggleCorrect(option.id)}
                  title={
                    block.selectionMode === 'single'
                      ? 'Mark as correct answer'
                      : 'Toggle correct answer'
                  }
                >
                  <div className="mcq-correct-inner" />
                </button>
              </div>
              <div className="mcq-option-content">
                <InlineRichTextEditor
                  value={option.content}
                  onChange={(newContent) => handleOptionContentChange(option.id, newContent)}
                  placeholder={`Option ${index + 1}...`}
                  minHeight="50px"
                />
              </div>
              <div className="mcq-option-actions">
                <button
                  type="button"
                  className="mcq-option-action-btn"
                  onClick={() => handleMoveOption(index, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  <MoveUp size={14} />
                </button>
                <button
                  type="button"
                  className="mcq-option-action-btn"
                  onClick={() => handleMoveOption(index, 'down')}
                  disabled={index === block.answer.options.length - 1}
                  title="Move down"
                >
                  <MoveDown size={14} />
                </button>
                <button
                  type="button"
                  className="mcq-option-action-btn mcq-option-action-btn--delete"
                  onClick={() => handleRemoveOption(option.id)}
                  disabled={block.answer.options.length <= 2}
                  title="Remove option"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="mcq-add-option-btn" onClick={handleAddOption}>
          <Plus size={14} />
          <span>Add Option</span>
        </button>
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
