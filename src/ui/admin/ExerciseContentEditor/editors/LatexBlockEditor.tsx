'use client'

import type { LatexBlock } from '@/server/payload/collections/Exercises/types'
import React from 'react'

interface LatexBlockEditorProps {
  block: LatexBlock
  onChange: (block: LatexBlock) => void
}

export const LatexBlockEditor: React.FC<LatexBlockEditorProps> = ({ block, onChange }) => {
  const handleLatexChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...block, latex: e.target.value })
  }

  const handleRenderModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...block, renderMode: e.target.value as 'block' | 'inline' })
  }

  const renderMode = block.renderMode ?? 'block'

  return (
    <div className="latex-block-editor">
      <div className="flex items-center gap-content-gap-xs mb-2">
        <label className="text-label">Render Mode:</label>
        <select
          value={renderMode}
          onChange={handleRenderModeChange}
          className="text-label px-1 py-0.5"
        >
          <option value="block">Block (display math)</option>
          <option value="inline">Inline</option>
        </select>
      </div>

      <textarea
        className="html-block-source-textarea font-mono"
        value={block.latex}
        onChange={handleLatexChange}
        placeholder="Enter LaTeX code here..."
        rows={8}
      />
    </div>
  )
}
