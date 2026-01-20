'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import type { Root, Element } from 'hast'
import { cn } from '@/utilities/ui'

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

      // Skip if already wrapped (check for Tailwind classes we use)
      if (
        className.includes('isolate') &&
        (className.includes('inline-block') || className.includes('block'))
      ) {
        return
      }

      // Check if parent is already a math wrapper or a katex element (to avoid nested wrapping)
      if (parent.type === 'element') {
        const parentClassName = Array.isArray(parent.properties?.className)
          ? parent.properties.className.join(' ')
          : String(parent.properties?.className || '')
        
        // Skip if parent is already wrapped (check for Tailwind classes we use)
        if (
          parentClassName.includes('isolate') &&
          (parentClassName.includes('inline-block') || parentClassName.includes('block'))
        ) {
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
            className: ['isolate', 'block', 'text-center', 'mt-3', 'mb-3'],
          },
          children: [node],
        }
        if (parent.type === 'element' || parent.type === 'root') {
          parent.children[index] = wrapper
        }
        return
      }

      // Inline math: wrap katex (only top-level, not nested)
      if (className.includes('katex') && !className.includes('katex-display') && node.tagName === 'span') {
        const wrapper: Element = {
          type: 'element',
          tagName: 'span',
          properties: {
            dir: 'ltr',
            className: ['isolate', 'inline-block', 'align-middle'],
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
