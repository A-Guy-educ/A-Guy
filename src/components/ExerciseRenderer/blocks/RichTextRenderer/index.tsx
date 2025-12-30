/**
 * Rich Text Renderer
 * Renders markdown with math support (KaTeX)
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import type { RichTextBlock } from '@/contracts'
import './index.scss'

const baseClass = 'rich-text-renderer'

interface RichTextRendererProps {
  block: RichTextBlock
}

export function RichTextRenderer({ block }: RichTextRendererProps) {
  return (
    <div className={baseClass}>
      <div className={`${baseClass}__content`}>
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {block.value}
        </ReactMarkdown>
      </div>
    </div>
  )
}
