'use client'

import { cn } from '@/infra/utils/ui'
import type { Components } from 'react-markdown'
import { MathMarkdown } from '@/ui/web/shared/MathMarkdown'
import { normalizeLatexDelimiters } from './normalize-latex'

interface ChatMessageContentProps {
  content: string
  className?: string
}

/**
 * Custom components for ReactMarkdown with Tailwind styling.
 * Implements the chat answer formatting spec:
 * - Paragraphs: 16-24px spacing, line-height 1.5-1.6
 * - Headings: semibold, 8-12px spacing below
 * - Emphasis: bold only (em rendered as font-medium, not italic)
 * - Lists: proper indentation and spacing
 */
const chatMarkdownComponents: Components = {
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
  table: ({ children }) => (
    <div className="chat-table my-4 overflow-x-auto rounded-lg border border-border shadow-sm">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-b-0 even:bg-muted/30">{children}</tr>
  ),
  th: ({ children }) => <th className="px-4 py-3 text-start font-bold text-primary">{children}</th>,
  td: ({ children }) => <td className="px-4 py-3 text-start">{children}</td>,
}

/**
 * Chat message content renderer.
 *
 * WHAT THIS ADDS ON TOP OF MathMarkdown:
 * 1. normalizeLatexDelimiters() — converts LLM-style delimiters (\[...\], \(...\))
 *    to the standard $$...$$ that remark-math understands.
 * 2. chatMarkdownComponents — custom Tailwind-styled typography for chat bubbles.
 * 3. "chat-message-content" CSS class — triggers chat-specific KaTeX styling
 *    (muted background, rounded corners, padding) defined in globals.css lines 422-436.
 */
export function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  const normalizedContent = normalizeLatexDelimiters(content)

  return (
    <MathMarkdown
      content={normalizedContent}
      className={cn('chat-message-content leading-relaxed', className)}
      components={chatMarkdownComponents}
    />
  )
}
