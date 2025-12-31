import React from 'react'
import type { SectionBlock } from '@/contracts'
import { BlockRenderer } from '../BlockRenderer'
import type { PreviewMode } from '../../types'

interface SectionRendererProps {
  block: SectionBlock
  mode?: PreviewMode
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({ block, mode }) => {
  return (
    <section className="my-4 border-l-2 border-gray-200 pl-4 ml-2">
      {(block.label || block.title) && (
        <header className="mb-2 font-semibold text-gray-700">
          {block.label && <span className="mr-2 text-primary">{block.label}</span>}
          {block.title && <span>{block.title}</span>}
        </header>
      )}
      <div className="section-content space-y-4">
        {block.blocks.map((childBlock) => (
          <BlockRenderer key={childBlock.id} block={childBlock} mode={mode} />
        ))}
      </div>
    </section>
  )
}
