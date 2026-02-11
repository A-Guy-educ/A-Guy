'use client'

import { cn } from '@/infra/utils/ui'
import type { Element, Root } from 'hast'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import { normalizeLatexDelimiters } from './normalize-latex'
import { rehypeKatexErrorHandler } from './rehype-katex-error-handler'

interface ChatMessageContentProps {
  content: string
  className?: string
  /** When true, skip math rendering (use during streaming to avoid partial-LaTeX errors) */
  isStreaming?: boolean
}

/**
 * Custom components for ReactMarkdown with Tailwind styling.
 * Implements the chat answer formatting spec:
 * - Paragraphs: 16-24px spacing, line-height 1.5-1.6
 * - Headings: semibold, 8-12px spacing below
 * - Emphasis: bold only (em rendered as font-medium, not italic)
 * - Lists: proper indentation and spacing
 */
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-4 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="text-xl font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="text-base font-semibold leading-tight mt-5 mb-2.5 first:mt-0">{children}</h6>
  ),
  ul: ({ children }) => <ul className="mb-4 ps-5 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 ps-5 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="mb-1 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="not-italic font-medium">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2 hover:text-primary/80">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 border border-border">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-s-4 border-primary mb-4 ps-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-0 border-t border-border my-5" />,
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

// Module-level constants to avoid ReactMarkdown pipeline re-creation
const REMARK_PLUGINS_MATH = [remarkMath]
const REMARK_PLUGINS_NONE: never[] = []
const REHYPE_PLUGINS_MATH = [rehypeKatex, rehypeKatexErrorHandler, rehypeMathWrapper]
const REHYPE_PLUGINS_NONE: never[] = []

export function ChatMessageContent({ content, className, isStreaming }: ChatMessageContentProps) {
  const enableMath = !isStreaming
  const processedContent = enableMath ? normalizeLatexDelimiters(content) : content

  return (
    <div className={cn('chat-message-content leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={enableMath ? REMARK_PLUGINS_MATH : REMARK_PLUGINS_NONE}
        rehypePlugins={enableMath ? REHYPE_PLUGINS_MATH : REHYPE_PLUGINS_NONE}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
