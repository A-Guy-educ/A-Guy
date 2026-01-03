import React from 'react'
import type { RichTextBlock } from '@/contracts'
import type { PreviewMode } from '../../types'
import { RichTextRenderer } from '../RichTextRenderer'
import './index.scss'

const baseClass = 'block-renderer'

interface BlockRendererProps {
  block: RichTextBlock
  mode?: PreviewMode
  availableAssets?: Record<string, string>
}

/**
 * BlockRenderer - Strict: Only supports RichTextBlock
 */
export function BlockRenderer({ block, mode = 'student' }: BlockRendererProps) {
  if (block.type !== 'rich_text') {
    return (
      <div className={`${baseClass} ${baseClass}--unknown`}>
        <span className={`${baseClass}__icon`}>⚠️</span>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <span>Invalid block type: {(block as any).type}. Only rich_text is supported.</span>
        {mode === 'debug' && (
          <code className={`${baseClass}__debug`}>{JSON.stringify(block, null, 2)}</code>
        )}
      </div>
    )
  }

  return <RichTextRenderer block={block} />
}
