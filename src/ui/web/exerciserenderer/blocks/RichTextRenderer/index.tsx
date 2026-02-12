/**
 * Rich Text Renderer
 * Renders markdown with math support (KaTeX)
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { preprocessNewlines } from './utils'

interface RichTextRendererProps {
  block: {
    type: 'rich_text'
    format: 'md-math-v1'
    value: string
    mediaIds?: string[]
  }
}

export function RichTextRenderer({ block }: RichTextRendererProps) {
  const processedValue = preprocessNewlines(block.value)
  
  return (
    <div className="rich-text-content leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {processedValue}
      </ReactMarkdown>
    </div>
  )
}
