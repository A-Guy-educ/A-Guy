/**
 * Rich Text Renderer
 * Renders markdown with math support (KaTeX)
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

interface RichTextRendererProps {
  block: {
    type: 'rich_text'
    format: 'md-math-v1'
    value: string
    mediaIds?: string[]
  }
}

/**
 * Preprocess text to render single newlines as visible line breaks.
 * Converts single \n to two trailing spaces + \n (Markdown hard line break).
 * Preserves existing hard breaks and paragraph breaks.
 */
function preprocessNewlines(text: string): string {
  // Replace single newlines with hard breaks (two spaces + newline)
  // But preserve existing hard breaks and paragraph breaks (multiple newlines)
  return text.replace(/([^\n])\n(?!\n)/g, '$1  \n')
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
