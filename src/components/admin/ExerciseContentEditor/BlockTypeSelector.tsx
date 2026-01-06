'use client'

import React from 'react'
import { FileText, CheckSquare, List, Edit3, X } from 'lucide-react'
import type { ContentBlock } from '@/collections/Exercises'

interface BlockTypeSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (blockType: ContentBlock['type']) => void
}

export const BlockTypeSelector: React.FC<BlockTypeSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null

  const blockTypes: Array<{
    type: ContentBlock['type']
    label: string
    description: string
    icon: React.ReactNode
  }> = [
    {
      type: 'rich_text',
      label: 'Rich Text',
      description: 'Markdown content with LaTeX math support',
      icon: <FileText size={20} />,
    },
    {
      type: 'question_select',
      label: 'Select Question',
      description: 'Question with selectable options (single mode)',
      icon: <CheckSquare size={20} />,
    },
    {
      type: 'question_mcq',
      label: 'Multiple Choice Question',
      description: 'Question with multiple options (single or multi-select)',
      icon: <List size={20} />,
    },
    {
      type: 'question_free_response',
      label: 'Free Response Question',
      description: 'Open-ended numeric or text answer',
      icon: <Edit3 size={20} />,
    },
  ]

  return (
    <div className="block-type-selector-overlay" onClick={onClose}>
      <div className="block-type-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="block-type-selector-header">
          <h3>Select Block Type</h3>
          <button className="icon-button" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="block-type-selector-grid">
          {blockTypes.map((blockType) => (
            <button
              key={blockType.type}
              className="block-type-option"
              onClick={() => {
                onSelect(blockType.type)
                onClose()
              }}
              type="button"
            >
              <div className="block-type-option-icon">{blockType.icon}</div>
              <div className="block-type-option-content">
                <div className="block-type-option-label">{blockType.label}</div>
                <div className="block-type-option-description">{blockType.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
