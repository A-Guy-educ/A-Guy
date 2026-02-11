'use client'

import React from 'react'
import type { ContentBlock } from '@/shared/exercise-content/types'
import { AdvancedJsonPanel } from '../../shared/AdvancedJsonPanel'

interface QuestionBlockWrapperProps {
  blockType: string
  block: ContentBlock
  onBlockChange: (block: ContentBlock) => void
  children: React.ReactNode
}

export const QuestionBlockWrapper: React.FC<QuestionBlockWrapperProps> = ({
  blockType,
  block,
  onBlockChange,
  children,
}) => {
  return (
    <div className="question-block-wrapper">
      <div className="question-block-type-badge">{blockType}</div>
      <div className="question-block-content">{children}</div>
      <div className="question-block-json-toggle">
        <AdvancedJsonPanel
          value={block}
          onChange={(value) => onBlockChange(value as ContentBlock)}
          label="Advanced JSON"
        />
      </div>
    </div>
  )
}
