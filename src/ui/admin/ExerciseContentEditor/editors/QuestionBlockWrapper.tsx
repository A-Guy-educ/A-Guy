'use client'

import React from 'react'
import type { ContentBlock } from '@/server/payload/collections/Exercises/types'
import { AdvancedJsonPanel } from '../../shared/AdvancedJsonPanel'
import { MoveUp, MoveDown, Copy, Trash2 } from 'lucide-react'

interface QuestionBlockWrapperProps {
  blockType: string
  block: ContentBlock
  onBlockChange: (block: ContentBlock) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  canMoveUp?: boolean
  canMoveDown?: boolean
  canDelete?: boolean
  children?: React.ReactNode
}

export const QuestionBlockWrapper: React.FC<QuestionBlockWrapperProps> = ({
  blockType,
  block,
  onBlockChange,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  canDelete = true,
  children,
}) => {
  return (
    <div className="container-block container-block--level-0">
      <div className="container-block__header">
        <div className="container-block__header-left">
          <span className="container-block__title">{blockType}</span>
        </div>
        <div className="container-block__actions">
          <button
            type="button"
            className="icon-button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Move up"
          >
            <MoveUp size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Move down"
          >
            <MoveDown size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onDuplicate}
            title="Duplicate block"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="icon-button icon-button--delete"
            onClick={onDelete}
            disabled={!canDelete}
            title="Delete block"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="container-block__body">
        <div className="question-block-content">{children}</div>
        <div className="question-block-json-toggle">
          <AdvancedJsonPanel
            value={block}
            onChange={(value) => onBlockChange(value as ContentBlock)}
            label="Advanced JSON"
          />
        </div>
      </div>
    </div>
  )
}
