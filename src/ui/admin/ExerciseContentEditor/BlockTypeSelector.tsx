'use client'

import {
  ArrowRightLeft,
  CheckSquare,
  Code,
  Edit3,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  LineChart,
  List,
  Table as TableIcon,
  Triangle,
  X,
  Film,
} from 'lucide-react'
import React from 'react'

interface BlockTypeSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (blockType: string) => void
}

export const BlockTypeSelector: React.FC<BlockTypeSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null

  const blockTypes: Array<{
    type: string
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
    {
      type: 'question_table',
      label: 'Table Question',
      description: 'Table-based question with fillable cells',
      icon: <TableIcon size={20} />,
    },
    {
      type: 'html',
      label: 'HTML Block',
      description: 'Rich WYSIWYG content (headings, lists, images, links)',
      icon: <Code size={20} />,
    },
    {
      type: 'question_matching',
      label: 'Matching',
      description: 'Match items between two columns',
      icon: <ArrowRightLeft size={20} />,
    },
    {
      type: 'svg',
      label: 'SVG Image',
      description: 'Raw SVG markup with live preview',
      icon: <ImageIcon size={20} />,
    },
    {
      type: 'media',
      label: 'Media',
      description: 'Reference to media file (image, video, PDF)',
      icon: <Film size={20} />,
    },
    {
      type: 'question_geometry',
      label: 'Geometry',
      description: 'Interactive geometry diagram',
      icon: <Triangle size={20} />,
    },
    {
      type: 'question_axis',
      label: 'Axis Graph',
      description: 'Coordinate graph with functions',
      icon: <LineChart size={20} />,
    },
    {
      type: 'question_multi_axis',
      label: 'Multi Axis Graph',
      description: 'Up to 4 graphs side by side (1, 2, or 4 per row)',
      icon: <LayoutGrid size={20} />,
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
