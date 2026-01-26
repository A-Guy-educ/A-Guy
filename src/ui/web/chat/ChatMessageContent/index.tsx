'use client'

import { cn } from '@/infra/utils/ui'
import type { Element, Root } from 'hast'
import type { Components } from 'react-markdown'
import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { visit } from 'unist-util-visit'
import { normalizeLatexDelimiters } from './normalize-latex'
import { isTableMessage, normalizeToTableModel } from '@/infra/llm/table-parser';
import { ChatTable } from './ChatTable';
import { ChatTableModel } from '@/infra/llm/table-types';

interface ChatMessageContentProps {
  content: string
  className?: string
}

// ... (markdownComponents and rehypeMathWrapper remain the same)

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
  ul: ({ children }) => <ul className="mb-4 pl-5 list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 pl-5 list-decimal">{children}</ol>,
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
    <blockquote className="border-l-4 border-primary mb-4 pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-0 border-t border-border my-5" />,
}

function rehypeMathWrapper() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const className = Array.isArray(node.properties?.className)
        ? node.properties.className.join(' ')
        : String(node.properties?.className || '')

      if (
        className.includes('isolate') &&
        (className.includes('inline-block') || className.includes('block'))
      ) {
        return
      }

      if (parent.type === 'element') {
        const parentClassName = Array.isArray(parent.properties?.className)
          ? parent.properties.className.join(' ')
          : String(parent.properties?.className || '')

        if (
          parentClassName.includes('isolate') &&
          (parentClassName.includes('inline-block') || parentClassName.includes('block'))
        ) {
          return
        }

        if (parentClassName.includes('katex')) {
          return
        }
      }

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

export function ChatMessageContent({ content, className }: ChatMessageContentProps) {
  const [isTable, setIsTable] = useState(false);
  const [tableData, setTableData] = useState<ChatTableModel | null>(null);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    setIsTable(false);
    setTableData(null);
    setParseError(false);

    try {
      if (isTableMessage(content)) {
        setIsTable(true);
        setTableData(normalizeToTableModel(content));
      }
    } catch (error) {
      console.error("Failed to parse table, falling back to text:", error);
      setParseError(true);
      setIsTable(false);
    }
  }, [content]);

  if (isTable && tableData && !parseError) {
    return <ChatTable data={tableData} />;
  }

  const normalizedContent = normalizeLatexDelimiters(content)

  return (
    <div className={cn('chat-message-content leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeMathWrapper]}
        components={markdownComponents}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}
