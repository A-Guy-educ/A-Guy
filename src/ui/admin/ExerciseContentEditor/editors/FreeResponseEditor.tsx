'use client'

import React from 'react'
import type { QuestionFreeResponseBlock } from '@/server/payload/collections/Exercises/types'
import { InlineRichTextEditor } from './InlineRichTextEditor'
import { HintSolutionPanel } from './HintSolutionPanel'
import { Plus, Trash2 } from 'lucide-react'

interface FreeResponseEditorProps {
  block: QuestionFreeResponseBlock
  onChange: (block: QuestionFreeResponseBlock) => void
}

export const FreeResponseEditor: React.FC<FreeResponseEditorProps> = ({ block, onChange }) => {
  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...block.answer.acceptedAnswers]
    newAnswers[index] = value
    onChange({ ...block, answer: { ...block.answer, acceptedAnswers: newAnswers } })
  }

  const handleAddAnswer = () => {
    onChange({
      ...block,
      answer: { ...block.answer, acceptedAnswers: [...block.answer.acceptedAnswers, ''] },
    })
  }

  const handleRemoveAnswer = (index: number) => {
    if (block.answer.acceptedAnswers.length <= 1) return
    const newAnswers = block.answer.acceptedAnswers.filter((_, i) => i !== index)
    onChange({ ...block, answer: { ...block.answer, acceptedAnswers: newAnswers } })
  }

  return (
    <div className="free-response-editor">
      <div className="question-editor-section">
        <label className="question-editor-label">Prompt</label>
        <InlineRichTextEditor
          value={block.prompt}
          onChange={(newPrompt) => onChange({ ...block, prompt: newPrompt })}
          placeholder="Enter your free response question..."
        />
      </div>

      <div className="question-editor-section">
        <label className="question-editor-label">Accepted Answers</label>
        <div className="accepted-answers-list">
          {block.answer.acceptedAnswers.map((answer, index) => (
            <div key={index} className="accepted-answer-row">
              <input
                type="text"
                className="accepted-answer-input"
                value={answer}
                onChange={(e) => handleAnswerChange(index, e.target.value)}
                placeholder={`Answer ${index + 1}`}
              />
              <button
                type="button"
                className="accepted-answer-remove-btn"
                onClick={() => handleRemoveAnswer(index)}
                disabled={block.answer.acceptedAnswers.length <= 1}
                title="Remove answer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="accepted-answer-add-btn" onClick={handleAddAnswer}>
          <Plus size={14} />
          <span>Add Answer</span>
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
