'use client'

import { cn } from '@/utilities/ui'
import type { Element, Root } from 'hast'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'

interface ChatMessageContentProps {
  content: string
  className?: string
}

/**
 * Rehype plugin to wrap KaTeX output with RTL isolation.
 * Adds wrapper elements at the AST level before React rendering.
 */
function rehypeMathWrapper() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const className = Array.isArray(node.properties?.className)
        ? node.properties.className.join(' ')
        : String(node.properties?.className || '')

      // Skip if already wrapped
      if (className.includes('math-inline') || className.includes('math-block')) return

      // Check if parent is already a math wrapper or a katex element (to avoid nested wrapping)
      if (parent.type === 'element') {
        const parentClassName = Array.isArray(parent.properties?.className)
          ? parent.properties.className.join(' ')
          : String(parent.properties?.className || '')

        // Skip if parent is already wrapped
        if (parentClassName.includes('math-inline') || parentClassName.includes('math-block')) {
          return
        }

        // Skip if parent is a katex element (we only wrap top-level katex)
        if (parentClassName.includes('katex')) {
          return
        }
      }

      // Block math: wrap katex-display
      if (className.includes('katex-display')) {
        const wrapper: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            dir: 'ltr',
            className: ['math-block'],
            style: 'unicode-bidi: isolate; direction: ltr; display: block; text-align: center;',
          },
          children: [node],
        }
        if (parent.type === 'element' || parent.type === 'root') {
          parent.children[index] = wrapper
        }
        return
      }

      // Inline math: wrap katex (only top-level, not nested)
      if (
        className.includes('katex') &&
        !className.includes('katex-display') &&
        node.tagName === 'span'
      ) {
        const wrapper: Element = {
          type: 'element',
          tagName: 'span',
          properties: {
            dir: 'ltr',
            className: ['math-inline'],
            style: 'unicode-bidi: isolate; direction: ltr; display: inline-block;',
          },
          children: [node],
        }
        if (parent.type === 'element' || parent.type === 'root') {
          parent.children[index] = wrapper
        }
      }
    })
  }
}

export function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  return (
    <div className={cn('chat-message-content', className)}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeMathWrapper]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
