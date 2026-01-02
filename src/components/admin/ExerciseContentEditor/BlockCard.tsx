'use client'

import React from 'react'
import { RichTextEditor } from './RichTextEditor'

interface BlockCardProps {
  block: any
  index: number
  total: number
  onChange: (updates: any) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export const BlockCard: React.FC<BlockCardProps> = ({ block, onChange }) => {
  return (
    <div className="block-card">
      <div className="block-card-content">
        <RichTextEditor
          value={block.value || ''}
          onChange={(val) => onChange({ ...block, value: val })}
        />
      </div>
    </div>
  )
}
