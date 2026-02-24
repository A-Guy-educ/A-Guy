'use client'

import React from 'react'
import type { MatchingOption } from '@/server/payload/collections/Exercises/types'
import { generateId } from '@/server/payload/collections/Exercises/types'
import { InlineRichTextEditor } from '../../editors/InlineRichTextEditor'
import { Plus, Trash2 } from 'lucide-react'

interface ColumnEditorProps {
  label: string
  options: MatchingOption[]
  onChange: (options: MatchingOption[]) => void
  minOptions?: number
}

export const ColumnEditor: React.FC<ColumnEditorProps> = ({
  label,
  options,
  onChange,
  minOptions = 2,
}) => {
  const handleAddOption = () => {
    const newOption: MatchingOption = {
      id: generateId(),
      content: { type: 'rich_text', format: 'md-math-v1', value: '', mediaIds: [] },
    }
    onChange([...options, newOption])
  }

  const handleRemoveOption = (optionId: string) => {
    if (options.length <= minOptions) return
    onChange(options.filter((o) => o.id !== optionId))
  }

  const handleContentChange = (
    optionId: string,
    content: { type: 'rich_text'; format: 'md-math-v1'; value: string; mediaIds: string[] },
  ) => {
    onChange(options.map((o) => (o.id === optionId ? { ...o, content } : o)))
  }

  return (
    <div className="matching-column-editor">
      <label className="question-editor-label">{label}</label>
      <div className="matching-column-list">
        {options.map((option, index) => (
          <div key={option.id} className="matching-column-row">
            <span className="matching-column-number">{index + 1}</span>
            <div className="matching-column-content">
              <InlineRichTextEditor
                value={option.content}
                onChange={(c) => handleContentChange(option.id, c)}
                placeholder={`Item ${index + 1}...`}
                minHeight="40px"
              />
            </div>
            <button
              type="button"
              className="matching-column-remove-btn"
              onClick={() => handleRemoveOption(option.id)}
              disabled={options.length <= minOptions}
              title="Remove item"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="matching-column-add-btn" onClick={handleAddOption}>
        <Plus size={14} />
        <span>Add Option</span>
      </button>
    </div>
  )
}
