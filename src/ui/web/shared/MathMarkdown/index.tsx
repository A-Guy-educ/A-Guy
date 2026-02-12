/**
 * @fileType component
 * @domain ui
 * @pattern shared-markdown
 * @ai-summary Shared markdown renderer with KaTeX math support and RTL isolation
 */

'use client'

import { cn } from '@/infra/utils/ui'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { rehypeMathWrapper } from './rehype-math-wrapper'

export interface MathMarkdownProps {
  /** The markdown string to render. Supports $...$ (inline) and $$...$$ (block) math. */
  content: string

  /** Optional CSS class name added to the wrapper <div>. */
  className?: string

  /**
   * Optional override for how markdown elements (p, h1, code, etc.) render.
   *
   * WHY this exists: Different contexts need different styling.
   * - Chat messages use custom Tailwind-styled headings, lists, code blocks.
   * - Exercise content uses the default browser rendering + .rich-text-content CSS.
   *
   * If you don't pass this, markdown elements render with their default HTML tags.
   */
  components?: Components
}

/**
 * Shared markdown renderer with math (KaTeX) support and RTL isolation.
 *
 * This is the BASE component — use it directly for exercise content,
 * or wrap it (like ChatMessageContent does) when you need extra behavior.
 *
 * WHAT IT DOES:
 * 1. Parses $...$ and $$...$$ delimiters in the markdown string (remarkMath)
 * 2. Converts them to KaTeX HTML (rehypeKatex)
 * 3. Wraps KaTeX output with dir="ltr" for RTL language support (rehypeMathWrapper)
 * 4. Renders the result as React elements
 *
 * WHAT IT DOES NOT DO (on purpose):
 * - LaTeX delimiter normalization (\[...\] -> $$...$$) — that's chat-specific
 * - Custom markdown element styling — pass `components` prop if needed
 * - Import katex CSS — already in globals.css (frontend) and custom.scss (admin)
 *
 * @example Basic usage (exercise content)
 * <MathMarkdown content="Solve $x^2 = 4$" className="rich-text-content" />
 *
 * @example With custom components (chat)
 * <MathMarkdown content={text} components={chatComponents} className="chat-message-content" />
 */
export function MathMarkdown({ content, className, components }: MathMarkdownProps) {
  return (
    <div className={cn(className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeMathWrapper]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
