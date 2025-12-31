import React from 'react'
import { RichTextBlock } from './RichTextBlock'
import type { ExerciseBlock } from '@/contracts'

interface BlockRendererProps {
  block: ExerciseBlock
  depth: number
}

export function BlockRenderer({ block, depth }: BlockRendererProps) {
  // Handle rich_text blocks
  if (block.type === 'rich_text') {
    return (
      <div
        className={`block-item ${depth > 0 ? 'ml-6 pl-4 border-l-2 border-slate-200' : ''}`}
        style={{ marginBottom: depth === 0 ? '1.5rem' : '1rem' }}
      >
        <RichTextBlock content={block.value} format={block.format} />
      </div>
    )
  }

  // Handle section blocks (recursive)
  if (block.type === 'section') {
    const sectionBlock = block as any // Type assertion for section
    return (
      <div
        className={`section-block ${depth > 0 ? 'ml-6 pl-4 border-l-2 border-blue-200' : ''}`}
        style={{ marginBottom: '1.5rem' }}
      >
        {sectionBlock.title && (
          <h3 className="text-lg font-semibold mb-3 text-slate-900">{sectionBlock.title}</h3>
        )}
        {sectionBlock.label && (
          <p className="text-sm text-slate-600 mb-2 font-medium uppercase tracking-wide">
            {sectionBlock.label}
          </p>
        )}
        <div className="space-y-3">
          {sectionBlock.blocks?.map((childBlock: ExerciseBlock, index: number) => (
            <BlockRenderer key={childBlock.id || index} block={childBlock} depth={depth + 1} />
          ))}
        </div>
      </div>
    )
  }

  // Unsupported block type fallback
  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded text-sm text-slate-600">
      <span className="font-mono">Unsupported block type: {block.type}</span>
    </div>
  )
}
